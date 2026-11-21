import type { DatasetDigest, DigestColumn, DigestTable, ModelId, Session } from '../types'
import { DIGEST_MAX_TABLES, SUGGESTION_COUNT } from '../constants'
import {
  isCategoricalColumn,
  isNumericColumn,
  isTemporalColumn,
} from '../profiling/buildDigest'

/**
 * Data-grounded suggestion engine.
 *
 * Derives specific, high-signal analytical questions directly from the active
 * dataset's actual columns, sample category values, numeric ranges, null counts,
 * and multi-file workspace context.
 */

export interface SuggestionInput {
  session: Session
  digest: DatasetDigest | null
  model: ModelId
  question?: string
  answer?: string
  allSessions?: Session[]
  signal?: AbortSignal
}

export interface LocalSuggestionOptions {
  question?: string
  answer?: string
  allSessions?: Session[]
}

/** Repairs a digest restored from an older/corrupt cache while preserving stats. */
function normalizeDigest(digest: DatasetDigest | null): DatasetDigest | null {
  if (!digest || !Array.isArray(digest.tables)) return null

  const tables: DigestTable[] = []
  for (const table of digest.tables) {
    if (!table || typeof table !== 'object') continue

    const columns: DigestColumn[] = []
    if (Array.isArray(table.columns)) {
      for (const column of table.columns) {
        if (!column || typeof column !== 'object') continue
        columns.push({
          name: typeof column.name === 'string' ? column.name : 'column',
          type: typeof column.type === 'string' ? column.type : 'VARCHAR',
          distinctCount:
            typeof column.distinctCount === 'number' ? column.distinctCount : 0,
          topValues: Array.isArray(column.topValues)
            ? column.topValues.filter((value): value is string => typeof value === 'string')
            : [],
          min: column.min ?? null,
          max: column.max ?? null,
          nullPct: typeof column.nullPct === 'number' ? column.nullPct : null,
        })
      }
    }

    tables.push({
      name: typeof table.name === 'string' ? table.name : 'table',
      rowCount: typeof table.rowCount === 'number' ? table.rowCount : 0,
      columns,
    })
  }

  return { tables: tables.slice(0, DIGEST_MAX_TABLES) }
}

function pickPrimaryTable(digest: DatasetDigest, session: Session): DigestTable | null {
  const tables = Array.isArray(digest.tables) ? digest.tables : []
  const preferred = tables.find((table) => table?.name === session.primaryTable)
  if (preferred && Array.isArray(preferred.columns) && preferred.columns.length > 0) return preferred

  const richest = [...tables].sort(
    (a, b) => (b.columns?.length ?? 0) - (a.columns?.length ?? 0),
  )[0]
  return richest && Array.isArray(richest.columns) && richest.columns.length > 0 ? richest : null
}

/** Turns `order_total_usd` into `order total usd` and strips generic banner prefixes. */
export function humanizeColumn(identifier: string): string {
  return identifier
    .replace(/\.[a-z0-9]{2,4}$/i, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function quoteValue(value: string): string {
  return `"${value}"`
}

function findTemporal(columns: DigestColumn[]): DigestColumn | null {
  return columns.find(isTemporalColumn) ?? null
}

const MEASURE_RANK: ReadonlyArray<RegExp> = [
  /(total|amount|revenue|sales|gmv|spend|profit|margin|balance|net|gross)/i,
  /(score|practical|theory|final|grade|mark|exam|quiz|test|gpa|point|pct|percent|average|avg|rate|rating|accuracy|benchmark)/i,
  /(price|cost|fee|value|salary|wage|income|budget)/i,
  /(qty|quantity|units|count|volume|attendance|hours|days)/i,
]

export function findMeasures(columns: DigestColumn[]): DigestColumn[] {
  const numeric = columns.filter(
    (c) => isNumericColumn(c) && !/^column_\d+$/i.test(c.name.trim()),
  )

  const rankOf = (column: DigestColumn): number => {
    const index = MEASURE_RANK.findIndex((pattern) => pattern.test(column.name))
    return index === -1 ? MEASURE_RANK.length : index
  }

  return [...numeric].sort((a, b) => rankOf(a) - rankOf(b)).slice(0, 4)
}

/**
 * Finds true grouping dimensions (columns whose values repeat across rows, not unique row names).
 */
export function findDimensions(columns: DigestColumn[], rowCount = 0): DigestColumn[] {
  return columns
    .filter((col) => {
      if (!isCategoricalColumn(col)) return false
      if (/^column_\d+$/i.test(col.name.trim())) return false
      // If a column is almost unique per row (e.g. 35 distinct Student Names in a 35-row sheet),
      // it is an entity label rather than a grouping category.
      if (rowCount >= 10 && col.distinctCount > Math.max(15, rowCount * 0.55)) {
        return false
      }
      if (/(^|[_.\s-])(student\s*name|full\s*name|person|email)($|[_.\s-])/i.test(col.name)) {
        return false
      }
      return true
    })
    .slice(0, 4)
}

/**
 * Finds an entity/record label column (e.g. Student Name, Product Name, Customer, Country)
 * suitable for top-N leaderboard rankings.
 */
export function findEntityColumn(columns: DigestColumn[], rowCount = 0): DigestColumn | null {
  const realCols = columns.filter((c) => !/^column_\d+$/i.test(c.name.trim()))
  const byName = realCols.find((c) =>
    /(^|[_.\s-])(name|student|customer|client|employee|product|item|model|country|city|company|school|title)($|[_.\s-])/i.test(
      c.name,
    ),
  )
  if (byName) return byName

  const highCardText = realCols.find(
    (c) =>
      /CHAR|TEXT|STR/i.test(c.type) &&
      c.distinctCount >= Math.min(10, Math.max(3, Math.floor(rowCount * 0.4))),
  )
  return highCardText ?? null
}

function isSimilarQuestion(candidate: string, asked: string): boolean {
  const normCandidate = candidate.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').trim()
  const normAsked = asked.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').trim()
  if (!normCandidate || !normAsked) return false
  if (
    normCandidate === normAsked ||
    normCandidate.includes(normAsked) ||
    normAsked.includes(normCandidate)
  ) {
    return true
  }
  const askedTokens = new Set(normAsked.split(/\s+/).filter((w) => w.length > 3))
  const candTokens = normCandidate.split(/\s+/).filter((w) => w.length > 3)
  if (askedTokens.size === 0 || candTokens.length === 0) return false
  const overlap = candTokens.filter((w) => askedTokens.has(w)).length
  return overlap / Math.min(askedTokens.size, candTokens.length) >= 0.72
}

/**
 * Deterministic, dataset-specific questions ordered by analytical value.
 */
export function buildLocalSuggestions(
  session: Session,
  digest: DatasetDigest | null,
  options?: LocalSuggestionOptions,
): string[] {
  const safeDigest = normalizeDigest(digest)
  const table = safeDigest ? pickPrimaryTable(safeDigest, session) : null
  const sessionTables = Array.isArray(session?.tables) ? session.tables : []
  const rawTableName = table?.name ?? session?.primaryTable ?? sessionTables[0]?.name ?? 'the data'
  const tableName = humanizeColumn(rawTableName)
  const rowCount = table?.rowCount ?? sessionTables[0]?.rowCount ?? 0
  const columns = table?.columns ?? []

  const temporal = findTemporal(columns)
  const measures = findMeasures(columns)
  const dimensions = findDimensions(columns, rowCount)
  const entityCol = findEntityColumn(columns, rowCount)

  const measure = measures[0]
  const secondMeasure = measures[1]
  const thirdMeasure = measures[2]
  const dimension = dimensions[0]
  const secondDimension = dimensions[1]

  const questions: string[] = []

  // 1. Multi-file workspace questions when multiple files are loaded
  const allLoaded = (options?.allSessions ?? []).filter(
    (s) => s && Array.isArray(s.tables) && s.tables.length > 0,
  )
  const otherSessions = allLoaded.filter((s) => s.id !== session.id)
  if (otherSessions.length >= 2) {
    const totalFiles = allLoaded.length
    if (measure) {
      questions.push(
        `Combine all ${totalFiles} uploaded files and compare average ${humanizeColumn(measure.name)} across each group with a chart.`,
      )
      questions.push(
        `Who are the top 10 performers by ${humanizeColumn(measure.name)} across all ${totalFiles} uploaded files?`,
      )
    } else {
      questions.push(
        `Combine all ${totalFiles} uploaded files into one dataset and compare their key metrics with a chart.`,
      )
    }
  } else if (otherSessions.length === 1) {
    const other = otherSessions[0]
    if (measure) {
      questions.push(
        `Compare ${humanizeColumn(measure.name)} between ${humanizeColumn(session.fileName)} and ${humanizeColumn(other.fileName)}.`,
      )
    } else {
      questions.push(
        `Compare ${humanizeColumn(session.fileName)} with ${humanizeColumn(other.fileName)} and highlight key differences.`,
      )
    }
  }

  // 2. Time-series trend question
  if (temporal && measure) {
    questions.push(
      `How has ${humanizeColumn(measure.name)} trended over ${humanizeColumn(temporal.name)}?`,
    )
  }

  // 3. Dimension breakdown / top category share
  if (dimension && measure) {
    const topValue = Array.isArray(dimension.topValues) ? dimension.topValues[0] : undefined
    if (topValue) {
      questions.push(
        `What share of ${humanizeColumn(measure.name)} comes from ${quoteValue(topValue)} in ${humanizeColumn(dimension.name)}?`,
      )
    }
    questions.push(
      `Compare average and total ${humanizeColumn(measure.name)} across each ${humanizeColumn(dimension.name)} with a bar chart.`,
    )
  }

  // 4. Entity leaderboard ranking (e.g. top 10 students/products/customers by score/revenue)
  if (entityCol && measure && entityCol.name !== dimension?.name) {
    questions.push(
      `Rank the top 10 ${humanizeColumn(entityCol.name)} records by ${humanizeColumn(measure.name)} and plot the comparison.`,
    )
  }

  // 5. Multi-measure correlation / comparison (e.g. Practical vs Theory, Revenue vs Margin)
  if (measure && secondMeasure) {
    questions.push(
      `How do ${humanizeColumn(measure.name)} and ${humanizeColumn(secondMeasure.name)} compare across the dataset?`,
    )
  }
  if (secondMeasure && thirdMeasure) {
    questions.push(
      `Compare ${humanizeColumn(secondMeasure.name)} and ${humanizeColumn(thirdMeasure.name)} and highlight any strong patterns.`,
    )
  }

  // 6. Cross-dimension breakdown
  if (dimension && secondDimension && measure) {
    questions.push(
      `Break down ${humanizeColumn(measure.name)} across ${humanizeColumn(dimension.name)} and ${humanizeColumn(secondDimension.name)}.`,
    )
  } else if (secondDimension && measure) {
    questions.push(
      `Plot ${humanizeColumn(measure.name)} across ${humanizeColumn(secondDimension.name)}.`,
    )
  } else if (dimension && secondMeasure) {
    questions.push(
      `Compare ${humanizeColumn(secondMeasure.name)} by ${humanizeColumn(dimension.name)}.`,
    )
  } else if (dimension) {
    questions.push(`Show the distribution of records across ${humanizeColumn(dimension.name)}.`)
  }

  // 7. Distribution, outliers, and data health grounded in real columns
  if (measure) {
    questions.push(
      `Show the distribution, average, and any outliers in ${humanizeColumn(measure.name)}.`,
    )
  }

  const nullCols = columns.filter((c) => typeof c.nullPct === 'number' && c.nullPct >= 1)
  if (nullCols.length > 0) {
    const colList = nullCols
      .slice(0, 2)
      .map((c) => humanizeColumn(c.name))
      .join(' and ')
    questions.push(`Inspect missing values in ${colList} and show how they affect the summary.`)
  }

  questions.push(`Summarize the most important patterns and top rankings in ${tableName}.`)

  const asked = options?.question?.trim()
  const filtered = asked
    ? questions.filter((q) => !isSimilarQuestion(q, asked))
    : questions

  return dedupe(filtered.length > 0 ? filtered : questions).slice(0, SUGGESTION_COUNT)
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

export async function generateSuggestions({
  session,
  digest,
  question,
  answer,
  allSessions,
}: SuggestionInput): Promise<string[]> {
  const safeDigest = normalizeDigest(digest)
  if (!question && !answer && !allSessions) {
    return buildLocalSuggestions(session, safeDigest)
  }
  return buildLocalSuggestions(session, safeDigest, { question, answer, allSessions })
}
