import type { Session, ToolName, ToolTraceEntry, TraceStatus } from '../types'
import { TRACE_DETAIL_LIMIT } from '../constants'
import { safeStringify } from '../utils/format'

export function createTraceId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `trace-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export interface TraceEntryInput {
  id: string
  sessionId: string
  toolName: ToolName
  args: Record<string, unknown>
  status: TraceStatus
  summary: string
  detail: string
  startedAt: number
  finishedAt: number | null
}

export function createTraceEntry(input: TraceEntryInput): ToolTraceEntry {
  return { ...input }
}

export function truncateDetail(value: unknown): string {
  const text = typeof value === 'string' ? value : safeStringify(value)
  if (text.length <= TRACE_DETAIL_LIMIT) return text
  return `${text.slice(0, TRACE_DETAIL_LIMIT)}\n… truncated for trace view`
}

export function summarizeToolResult(
  toolName: ToolName,
  result: Record<string, unknown>,
): string {
  if (toolName === 'inspect_schema') {
    const tables = Array.isArray(result.tables) ? result.tables : []
    const columnCount = tables.reduce((total, table) => {
      if (typeof table !== 'object' || table === null) return total
      const columns = (table as { columns?: unknown }).columns
      return total + (Array.isArray(columns) ? columns.length : 0)
    }, 0)
    if (tables.length === 0) return 'Schema inspected — no tables found'
    return `Inspected ${tables.length} table${tables.length === 1 ? '' : 's'} · ${columnCount} columns`
  }

  if (toolName === 'run_sql') {
    const rowCount = typeof result.rowCount === 'number' ? result.rowCount : 0
    const returnedRows = typeof result.returnedRows === 'number' ? result.returnedRows : 0
    const elapsedMs = typeof result.elapsedMs === 'number' ? result.elapsedMs : 0
    const truncated = result.truncated === true
    const shown = truncated ? `${returnedRows} of ${rowCount}` : `${rowCount}`
    return `${shown} row${rowCount === 1 ? '' : 's'} · ${elapsedMs} ms`
  }

  return 'Completed'
}

export function summarizeToolError(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return safeStringify(error, 0)
}

export function buildTraceExport(session: Session, traces: ToolTraceEntry[]): string {
  return safeStringify(
    {
      app: 'Tabula',
      exportedAt: new Date().toISOString(),
      session: {
        fileName: session.fileName,
        fileType: session.fileType,
        schemaName: session.schemaName,
        uploadedAt: new Date(session.uploadedAt).toISOString(),
        tables: session.tables,
      },
      toolCalls: traces,
    },
    2,
  )
}

export function traceExportFileName(session: Session): string {
  const base = session.fileName.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]+/g, '-')
  return `${base || 'tabula'}-trace.json`
}
