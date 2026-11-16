import type { PythonExecutionResult } from '../../core/python'

const MAX_TOOL_STDOUT_CHARS = 2400
const MAX_TOOL_PREVIEW_ROWS = 15
const MAX_TOOL_PREVIEW_COLS = 12
const MAX_TOOL_CELL_CHARS = 80

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
 * The UI still receives the full uncompacted result via `onPythonResult`.
 */
export function compactPythonToolResult(result: PythonExecutionResult | null | undefined) {
  const plotCount = Array.isArray(result?.images) ? result.images.length : 0
  const hasError = Boolean(result?.error)
  const preview = !hasError ? result?.dfPreview : undefined
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
    stderr: compactText(result?.stderr, 800),
    hasPlots: plotCount > 0,
    plotCount,
    elapsedMs: result?.elapsedMs ?? 0,
    error: result?.error ?? null,
    dfInfo: result?.dfInfo,
    dfPreview: compactPreview,
  }
}
