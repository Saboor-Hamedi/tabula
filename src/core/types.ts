export type ModelId = 'deepseek-v4-flash' | 'deepseek-v4-pro'

export type FileKind = 'csv' | 'xlsx'

export type CellValue = string | number | boolean | null

export interface ColumnProfile {
  name: string
  type: string
  nullCount: number
  distinctCount: number
  min: string | null
  max: string | null
  samples: CellValue[]
}

export interface TableProfile {
  table: string
  qualifiedName: string
  rowCount: number
  columnCount: number
  columns: ColumnProfile[]
}

export interface TableSummary {
  name: string
  rowCount: number
  columnCount: number
}

export interface IngestResult {
  tables: TableSummary[]
  primaryTable: string | null
}

export interface QueryResult {
  columns: string[]
  rows: Array<Record<string, CellValue>>
  rowCount: number
  returnedRows: number
  truncated: boolean
  elapsedMs: number
}

export interface Session {
  id: string
  fileName: string
  fileType: FileKind
  uploadedAt: number
  schemaName: string
  tables: TableSummary[]
  primaryTable: string | null
}

export type ChatRole = 'user' | 'assistant'

export interface ChatMessage {
  id: string
  role: ChatRole
  content: string
  createdAt: number
  error?: boolean
  welcome?: boolean
}

export type TraceStatus = 'running' | 'success' | 'error'

export interface ToolTraceEntry {
  id: string
  sessionId: string
  toolName: string
  args: Record<string, unknown>
  status: TraceStatus
  summary: string
  detail: string
  startedAt: number
  finishedAt: number | null
}

export type UploadPhase = 'idle' | 'reading' | 'ingesting' | 'done' | 'error'

export interface UploadState {
  phase: UploadPhase
  fileName: string | null
  message: string
}

export type ContentBlock =
  | { type: 'markdown'; content: string }
  | { type: 'mermaid'; code: string }
  | { type: 'table'; headers: string[]; rows: string[][] }

export interface MermaidBlockData {
  type: 'mermaid'
  code: string
}

export interface MarkdownBlockData {
  type: 'markdown'
  content: string
}

export interface TableBlockData {
  type: 'table'
  headers: string[]
  rows: string[][]
}

export type RawBlock = MarkdownBlockData | MermaidBlockData | TableBlockData

export type ToolName = 'inspect_schema' | 'run_sql'

export interface InspectSchemaArgs {
  table?: string
}

export interface RunSqlArgs {
  sql: string
  purpose?: string
}

export interface ToolResultPayload {
  [key: string]: unknown
}
