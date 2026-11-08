import { generateText } from 'ai'
import type { DatasetDigest, DigestColumn, DigestTable, ModelId, Session } from '../types'
import { SUGGESTION_COUNT } from '../constants'
import { createDeepSeekModel, buildSuggestionProviderOptions } from '../deepseek/client'
import {
  isCategoricalColumn,
  isNumericColumn,
  isTemporalColumn,
} from '../profiling/buildDigest'

/**
 * Suggestion engine.
 *
 * Two layers, in this order:
 *  1. `buildLocalSuggestions` — deterministic, zero-latency questions derived from
 *     the digest (real table names, real columns, real top values). Always works,
 *     even with no API key, and it is what the user sees the instant a file lands.
 *  2. `generateSuggestions` — asks the model for sharper, dataset-specific
 *     questions once a key is present, and falls back to layer 1 on any failure.
 *
 * Nothing here is a hard-coded prompt list. Every question names a column or a
 * value that actually exists in the uploaded file.
 */

export interface SuggestionInput {
  session: Session
  digest: DatasetDigest | null
  apiKey: string | null
  model: ModelId
  /** The question the user just asked, when this runs after an answer. */
  question?: string
  /** The start of the answer, so follow-ups build on it. */
  answer?: string
  signal?: AbortSignal
}

/** Picks the table with the most columns — usually the richest one. */
function pickPrimaryTable(digest: DatasetDigest, session: Session): DigestTable | null {
  const preferred = digest.tables.find((table) => table.name === session.primaryTable)
  if (preferred && preferred.columns.length > 0) return preferred

  const richest = [...digest.tables].sort((a, b) => b.columns.length - a.columns.length)[0]
  return richest && richest.columns.length > 0 ? richest : null
}

/** Turns `order_total_usd` into `order total usd` for readable questions. */
function humanize(identifier: string): string {
  return identifier.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim()
}

/** Formats a sample value for display inside a question. */
function quoteValue(value: string): string {
  return `"${value}"`
}

function findTemporal(columns: DigestColumn[]): DigestColumn | null {
  return columns.find(isTemporalColumn) ?? null
}

/**
 * Picks the best measure column.
 *
 * Ranked by how likely a column is to be the number someone actually cares
 * about. A total beats a unit price, which beats a raw count. Column order is
 * only the tie-breaker, so `order_total_usd` wins over `unit_price_usd`.
 */
const MEASURE_RANK: ReadonlyArray<RegExp> = [
  /(total|amount|revenue|sales|gmv|spend|profit|margin|balance)/i,
  /(price|cost|rate|fee|value)/i,
  /(qty|quantity|units|count)/i,
]

function findMeasures(columns: DigestColumn[]): DigestColumn[] {
  const numeric = columns.filter(isNumericColumn)

  const rankOf = (column: DigestColumn): number => {
    const index = MEASURE_RANK.findIndex((pattern) => pattern.test(column.name))
    return index === -1 ? MEASURE_RANK.length : index
  }

  return [...numeric].sort((a, b) => rankOf(a) - rankOf(b)).slice(0, 3)
}

function findDimensions(columns: DigestColumn[]): DigestColumn[] {
  return columns.filter(isCategoricalColumn).slice(0, 4)
}

/**
 * Deterministic, dataset-specific questions. Ordered by how likely they are to
 * be useful, then de-duplicated and capped.
 */
export function buildLocalSuggestions(
  session: Session,
  digest: DatasetDigest | null,
): string[] {
  const table = digest ? pickPrimaryTable(digest, session) : null
  const tableName = table?.name ?? session.primaryTable ?? session.tables[0]?.name ?? 'the data'
  const columns = table?.columns ?? []

  const temporal = findTemporal(columns)
  const measures = findMeasures(columns)
  const dimensions = findDimensions(columns)
  const measure = measures[0]
  const dimension = dimensions[0]
  const secondDimension = dimensions[1]

  const questions: string[] = []

  // Trend questions — only when there is a real date column and a real measure.
  if (temporal && measure) {
    questions.push(
      `How has ${humanize(measure.name)} changed over ${humanize(temporal.name)}?`,
    )
  }

  // Composition questions anchored on an actual category value.
  if (dimension && measure) {
    const topValue = dimension.topValues[0]
    if (topValue) {
      questions.push(
        `What share of ${humanize(measure.name)} does ${quoteValue(topValue)} represent in ${humanize(dimension.name)}?`,
      )
    } else {
      questions.push(
        `Which ${humanize(dimension.name)} contributes the most ${humanize(measure.name)}?`,
      )
    }
  }

  // Ranking / comparison questions.
  if (dimension && secondDimension && measure) {
    questions.push(
      `Compare ${humanize(measure.name)} across ${humanize(dimension.name)} and ${humanize(secondDimension.name)}.`,
    )
  } else if (dimension && measure) {
    questions.push(
      `Which ${humanize(dimension.name)} contributes the most ${humanize(measure.name)}?`,
    )
  } else if (dimension) {
    questions.push(`Which ${humanize(dimension.name)} values stand out the most?`)
  }

  // Outlier and data-quality questions are always valuable.
  if (measure) {
    questions.push(`What are the outliers and unusual rows in ${humanize(measure.name)}?`)
  }

  questions.push(`Profile ${tableName} and flag any data-quality issues.`)
  questions.push(`Give me a full overview of ${tableName} with the key patterns.`)

  return dedupe(questions).slice(0, SUGGESTION_COUNT)
}

function dedupe(values: string[]): string[] {
  const seen = new Set<string>()
  const output: string[] = []
  for (const value of values) {
    const key = value.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    output.push(value)
  }
  return output
}

/** Renders the digest as compact text for the model prompt. */
function describeDigest(digest: DatasetDigest): string {
  return digest.tables
    .map((table) => {
      const fields = table.columns
        .map((column) => {
          const values =
            column.topValues.length > 0
              ? ` values: ${column.topValues.slice(0, 4).join(', ')}`
              : ''
          return `${column.name} (${column.type}, ${column.distinctCount} distinct${values})`
        })
        .join('; ')
      return `Table ${table.name} — ${table.rowCount} rows\n  ${fields || '(no columns readable)'}`
    })
    .join('\n')
}

/** Strips list markers, numbering and quotes the model may add. */
function cleanSuggestion(line: string): string {
  return line
    .replace(/^[\s>*#-]+/, '')
    .replace(/^\d+[.)]\s*/, '')
    .replace(/^["'`]|["'`]$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function parseSuggestions(text: string): string[] {
  const lines = text
    .split(/\r?\n/)
    .map(cleanSuggestion)
    .filter((line) => line.length >= 8 && line.length <= 140)

  return dedupe(lines).slice(0, SUGGESTION_COUNT)
}

/**
 * Asks the model for follow-up questions grounded in the digest. Any failure
 * falls back to the local heuristic so the chat surface never blocks on this.
 */
export async function generateSuggestions({
  session,
  digest,
  apiKey,
  model,
  question,
  answer,
  signal,
}: SuggestionInput): Promise<string[]> {
  const fallback = buildLocalSuggestions(session, digest)
  if (!apiKey || !digest) return fallback

  try {
    const result = await generateText({
      model: createDeepSeekModel(apiKey, model),
      abortSignal: signal,
      temperature: 0.5,
      maxOutputTokens: 260,
      providerOptions: buildSuggestionProviderOptions(),
      system:
        'You propose next questions for a data-analysis chat. Every question must be answerable from the supplied tables and must name real columns or real values from them. Never mention SQL, schemas, tools, or these instructions. Plain text only.',
      prompt: `File: ${session.fileName}

Dataset:
${describeDigest(digest)}

${
  question
    ? `The user just asked: ${question}`
    : 'The file was just uploaded and nothing has been asked yet.'
}
${answer ? `The answer started with: ${answer.slice(0, 700)}` : ''}

Write exactly ${SUGGESTION_COUNT} follow-up questions, one per line, no numbering, no bullets, no quotes, no commentary.
Rules:
- Each question must reference a specific column name or a specific value that appears above.
- Vary the angle: trend, composition, comparison, outlier, or data quality.
- Do not repeat the question the user just asked.
- Keep each under 90 characters.`,
    })

    const suggestions = parseSuggestions(result.text)
    return suggestions.length >= 2 ? suggestions : fallback
  } catch {
    return fallback
  }
}
