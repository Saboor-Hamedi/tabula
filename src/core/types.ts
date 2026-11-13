/**
 * Shared domain types.
 *
 * `core/` owns these; `features/` only consumes them. Keeping them in one file
 * means a component and the agent layer can never drift apart.
 */

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
  fileSize: number
  uploadedAt: number
  schemaName: string
  tables: TableSummary[]
  primaryTable: string | null
  /** Sheets chosen by the user for a large workbook. */
  selectedSheets?: string[]
}

export interface SheetInfo {
  name: string
  rowCount: number
  columnCount: number
}

export type ChatRole = 'user' | 'assistant'

export interface ChatMessage {
  id: string
  role: ChatRole
  content: string
  createdAt: number
  error?: boolean
  /** Set when a turn failed due to an expired trial or exhausted token quota. */
  upgradeReason?: 'trial-expired' | 'quota-exceeded'
  model?: ModelId
  /** Marks the message the agent writes right after a file is ingested. */
  welcome?: boolean
  /** Data-derived follow-up questions rendered under the message. */
  suggestions?: string[]
  /** True while the suggestion pass is still running. */
  suggestionsPending?: boolean
  /** Token usage for this answer, when the provider reports it. */
  usage?: {
    inputTokens: number
    outputTokens: number
  }
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

/** Tabs of the right-hand inspector. */
export type PanelTab = 'file' | 'notes' | 'python' | 'trace'

export type UploadPhase = 'idle' | 'reading' | 'ingesting' | 'done' | 'error'

export interface UploadState {
  phase: UploadPhase
  fileName: string | null
  message: string
}

export interface UploadQueueItem {
  id: string
  fileName: string
  phase: UploadPhase | 'queued'
  message: string
}

export interface ElbowPoint {
  x: number
  y: number
}

/**
 * A structured figure that Mermaid cannot express, such as an annotated elbow
 * chart with a circled optimal rank.
 */
export interface ElbowChartData {
  type: 'elbow'
  title: string
  xLabel: string
  yLabel: string
  points: ElbowPoint[]
  elbowX: number
  elbowLabel?: string
  note?: string
  /** Optional color for every title, label, tick and legend in the figure. */
  textColor?: string
}

export interface SeriesPoint {
  label: string
  value: number
}

export interface SeriesChartData {
  type: 'series'
  kind: 'bar' | 'line' | 'scatter'
  title: string
  xLabel: string
  yLabel: string
  points: SeriesPoint[]
  highlightIndex?: number
  highlightLabel?: string
  note?: string
  textColor?: string
}

export type ChartData = ElbowChartData | SeriesChartData

export type ContentBlock =
  | { type: 'markdown'; content: string }
  | { type: 'mermaid'; code: string }
  | { type: 'chart'; chart: ChartData }
  | { type: 'table'; headers: string[]; rows: string[][]; alignments?: ('left' | 'right' | 'center')[] }

export interface MermaidBlockData {
  type: 'mermaid'
  code: string
}

export interface MarkdownBlockData {
  type: 'markdown'
  content: string
}

export interface ChartBlockData {
  type: 'chart'
  chart: ChartData
}

export interface TableBlockData {
  type: 'table'
  headers: string[]
  rows: string[][]
  alignments?: ('left' | 'right' | 'center')[]
}

export type RawBlock = MarkdownBlockData | MermaidBlockData | ChartBlockData | TableBlockData

export type ToolName = 'inspect_schema' | 'run_sql' | 'run_python'

export interface InspectSchemaArgs {
  table?: string
}

export interface RunSqlArgs {
  sql: string
  purpose?: string
}

export interface RunPythonArgs {
  code: string
  purpose?: string
}

export interface ToolResultPayload {
  [key: string]: unknown
}

/** One column as understood by the digest builder. */
export interface DigestColumn {
  name: string
  type: string
  distinctCount: number
  topValues: string[]
}

/** Compact, model-friendly description of one table. */
export interface DigestTable {
  name: string
  rowCount: number
  columns: DigestColumn[]
}

/**
 * A cheap, local snapshot of the dataset. Used to seed suggestions and the
 * welcome message without spending a model call.
 */
export interface DatasetDigest {
  tables: DigestTable[]
}
