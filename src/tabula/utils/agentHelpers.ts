import type { PythonExecutionResult } from '../../core/python'
import type { CellValue, QueryResult } from '../../core/types'

const MAX_TOOL_STDOUT_CHARS = 1800
const MAX_TOOL_PREVIEW_ROWS = 15
const MAX_TOOL_PREVIEW_COLS = 12
const MAX_TOOL_CELL_CHARS = 80
const MAX_SQL_LLM_ROWS = 30

/**
 * Extracts a partial `code` or `sql` string value from a streaming JSON tool-call
 * argument buffer so the user can watch the agent write code live in the chat wrapper.
 */
export function extractStreamingCodeArg(rawJson: string, key: 'code' | 'sql'): string {
  const keyPattern = new RegExp(`"${key}"\\s*:\\s*"`)
  const match = keyPattern.exec(rawJson)
  if (!match) return ''
  const start = match.index + match[0].length
  let out = ''
  let i = start
  while (i < rawJson.length) {
    const ch = rawJson[i]
    if (ch === '"') {
      break
    }
    if (ch === '\\') {
      if (i + 1 >= rawJson.length) break
      const next = rawJson[i + 1]
      if (next === 'n') out += '\n'
      else if (next === 't') out += '\t'
      else if (next === 'r') out += ''
      else if (next === '"') out += '"'
      else if (next === '\\') out += '\\'
      else if (next === '/') out += '/'
      else if (next === 'u' && i + 5 < rawJson.length) {
        const hex = rawJson.slice(i + 2, i + 6)
        const codePoint = Number.parseInt(hex, 16)
        if (Number.isFinite(codePoint)) {
          out += String.fromCharCode(codePoint)
          i += 6
          continue
        }
        out += next
      } else {
        out += next
      }
      i += 2
      continue
    }
    out += ch
    i += 1
  }
  return out.replace(/[\r\n\s]+$/, '')
}

/**
 * Strips accidental markdown code fences (```sql ... ``` or ```python ... ```)
 * if the model wraps a tool argument in fenced blocks.
 */
export function stripCodeFences(raw: string): string {
  const trimmed = raw.trim()
  const fenceMatch = /^```[a-zA-Z0-9_-]*\r?\n([\s\S]*?)\r?\n?```$/.exec(trimmed)
  return fenceMatch ? fenceMatch[1].trim() : trimmed
}

/**
 * Formats Python code cleanly for display in the chat code wrapper:
 * removes noisy ASCII banner walls (# =====, # -----), strips empty lines,
 * and removes redundant bare trailing variable expressions like `summary`.
 */
export function formatPythonForDisplay(raw: string): string {
  const unfenced = stripCodeFences(raw).replace(/\r\n/g, '\n')
  const lines = unfenced
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/, ''))
    .filter(
      (line) =>
        line.trim().length > 0 &&
        !/^\s*#\s*[=_-]{4,}\s*#*$/.test(line) &&
        !/^\s*#+\s*summary\s*#*$/i.test(line),
    )

  // If the last line is a bare identifier like `summary` or `df` (after assigning it above), drop it
  if (
    lines.length > 1 &&
    /^(?:summary|summary_df|df|out|result_df|final_df)$/i.test(lines[lines.length - 1].trim())
  ) {
    lines.pop()
  }

  return lines.join('\n')
}

const TOP_LEVEL_SQL_CLAUSES = [
  'UNION ALL BY NAME',
  'UNION ALL',
  'UNION',
  'LEFT OUTER JOIN',
  'RIGHT OUTER JOIN',
  'FULL OUTER JOIN',
  'LEFT JOIN',
  'RIGHT JOIN',
  'INNER JOIN',
  'FULL JOIN',
  'CROSS JOIN',
  'JOIN',
  'FROM',
  'WHERE',
  'GROUP BY',
  'HAVING',
  'QUALIFY',
  'ORDER BY',
  'LIMIT',
  'OFFSET',
]

/**
 * Formats SQL cleanly for display in the chat code wrapper.
 * If a long SQL query is written on a single line, breaks top-level clauses
 * (outside strings and parentheses) onto clean, readable lines.
 */
export function formatSqlForDisplay(raw: string): string {
  // Strip internal DuckDB session schema prefixes like "s_1234abcd"."table" -> "table" for cleaner display
  const unfenced = stripCodeFences(raw)
    .replace(/\r\n/g, '\n')
    .replace(/"s_[a-z0-9_]+"\.("?[A-Za-z0-9_ -]+"?)/gi, '$1')
    .replace(/\bs_[a-z0-9_]+\.("?[A-Za-z0-9_ -]+"?)/gi, '$1')
    .trim()
  if (!unfenced) return ''

  const lines = unfenced
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/, ''))
    .filter((line) => line.trim().length > 0 && !/^\s*--\s*[=_-]{4,}\s*$/.test(line))

  let text = lines.join('\n').trim()

  // If it's a long single-line query, insert clean line breaks before top-level clauses
  if (!text.includes('\n') && text.length > 64) {
    let depth = 0
    let inSingle = false
    let inDouble = false
    const breakIndices: number[] = []

    for (let i = 0; i < text.length; i++) {
      const ch = text[i]
      if (ch === "'" && !inDouble) {
        inSingle = !inSingle
        continue
      }
      if (ch === '"' && !inSingle) {
        inDouble = !inDouble
        continue
      }
      if (inSingle || inDouble) continue
      if (ch === '(') {
        depth += 1
        continue
      }
      if (ch === ')') {
        depth = Math.max(0, depth - 1)
        continue
      }
      if (depth === 0 && i > 0 && /\s/.test(text[i - 1])) {
        const rest = text.slice(i)
        for (const clause of TOP_LEVEL_SQL_CLAUSES) {
          const re = new RegExp(`^${clause.replace(/\s+/g, '\\s+')}\\b`, 'i')
          if (re.test(rest)) {
            breakIndices.push(i)
            i += clause.length - 1
            break
          }
        }
      }
    }

    if (breakIndices.length > 0) {
      const parts: string[] = []
      let prev = 0
      for (const idx of breakIndices) {
        parts.push(text.slice(prev, idx).trim())
        prev = idx
      }
      parts.push(text.slice(prev).trim())
      text = parts.filter(Boolean).join('\n')
    }
  }

  return text
}

/**
 * Extracts a concise 1–2 line error summary from a Python traceback or SQL error,
 * stripping internal Pyodide/WASM stack frames to save tokens and keep UI clean.
 */
export function cleanCodeError(raw: string | null | undefined): string {
  if (!raw) return ''
  const lines = raw
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
  if (lines.length === 0) return ''

  // Find the final exception line (e.g. "KeyError: 'col'", "ValueError: ...")
  for (let i = lines.length - 1; i >= 0; i--) {
    if (/^[A-Za-z_][A-Za-z0-9_.]*(?:Error|Exception|Warning):/.test(lines[i])) {
      // Include the `<input>` line reference if present right above it
      const inputLine = lines
        .slice(0, i)
        .reverse()
        .find((l) => l.includes('File "<input>"'))
      const lineMatch = inputLine ? /line\s+(\d+)/i.exec(inputLine) : null
      return lineMatch ? `Line ${lineMatch[1]}: ${lines[i]}` : lines[i]
    }
  }

  const last = lines[lines.length - 1]
  return last.length > 220 ? `${last.slice(0, 217)}…` : last
}

/**
 * Truncates long text middle-out or tail-end so tool outputs stay within a
 * compact token budget without losing the error or summary.
 */
export function compactText(value: string | undefined, maxChars = MAX_TOOL_STDOUT_CHARS): string {
  if (!value) return ''
  if (value.length <= maxChars) return value
  const head = value.slice(0, maxChars - 80)
  return `${head}\n… [truncated ${value.length - head.length} chars]`
}

/**
 * Compacts Python execution results before returning them to the LLM so large
 * DataFrames or verbose stdout do not burn thousands of input tokens.
 * The UI still receives the full uncompacted result via `onPythonResult` and `onCodeStep`.
 */
export function compactPythonToolResult(result: PythonExecutionResult | null | undefined) {
  const plotCount = Array.isArray(result?.images) ? result.images.length : 0
  const hasError = Boolean(result?.error)
  const dfWasUnchanged = result?.dfInfo?.dfChanged === false
  // Skip sending 15 rows of the untouched raw DataFrame back to the LLM when the script
  // only generated a plot or stdout without modifying df.
  const includePreview = !hasError && (!dfWasUnchanged || (plotCount === 0 && !result?.stdout?.trim()))
  const preview = includePreview ? result?.dfPreview : undefined
  const compactPreview = preview
    ? {
        columns: preview.columns.slice(0, MAX_TOOL_PREVIEW_COLS),
        rows: preview.rows
          .slice(0, MAX_TOOL_PREVIEW_ROWS)
          .map((row) =>
            row.slice(0, MAX_TOOL_PREVIEW_COLS).map((cell) =>
              typeof cell === 'string' && cell.length > MAX_TOOL_CELL_CHARS
                ? `${cell.slice(0, MAX_TOOL_CELL_CHARS - 1)}…`
                : cell,
            ),
          ),
        totalRows: preview.totalRows,
        totalCols: preview.totalCols,
        truncatedForAgent:
          preview.rows.length > MAX_TOOL_PREVIEW_ROWS ||
          preview.columns.length > MAX_TOOL_PREVIEW_COLS,
      }
    : undefined

  return {
    stdout: compactText(result?.stdout),
    stderr: compactText(result?.stderr, 600),
    hasPlots: plotCount > 0,
    plotCount,
    elapsedMs: result?.elapsedMs ?? 0,
    error: result?.error ? cleanCodeError(result.error) : null,
    dfInfo: result?.dfInfo,
    dfPreview: compactPreview,
  }
}

/**
 * Compacts SQL query results sent to the LLM by capping rows and truncating
 * long string cells, while preserving full results for the UI code wrapper table.
 */
export function compactSqlToolResult(
  result: QueryResult,
  purpose?: string | null,
  maxLlmRows = MAX_SQL_LLM_ROWS,
) {
  const safeRows = Array.isArray(result.rows) ? result.rows : []
  const capped = safeRows.slice(0, maxLlmRows).map((row) => {
    if (!row || typeof row !== 'object') return row
    const out: Record<string, CellValue> = {}
    for (const [key, val] of Object.entries(row)) {
      out[key] =
        typeof val === 'string' && val.length > MAX_TOOL_CELL_CHARS
          ? `${val.slice(0, MAX_TOOL_CELL_CHARS - 1)}…`
          : val
    }
    return out
  })
  const llmTruncated = result.truncated || safeRows.length > maxLlmRows

  return {
    columns: result.columns,
    rows: capped,
    rowCount: result.rowCount,
    returnedRows: capped.length,
    truncated: llmTruncated,
    elapsedMs: result.elapsedMs,
    purpose: purpose ?? undefined,
    note: llmTruncated
      ? `Showing ${capped.length} of ${result.rowCount} rows to save tokens (the full result table is displayed in the chat UI).`
      : undefined,
  }
}
