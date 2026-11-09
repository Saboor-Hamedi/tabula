/**
 * Application-wide constants.
 *
 * Everything tunable lives here so components never hard-code magic numbers.
 * Anything that is *derived* from the user's data (tables, columns, row counts,
 * suggestions) must never appear in this file — it is computed at runtime.
 */

export const APP_NAME = 'Tabula'
export const APP_TAGLINE = 'Ask your spreadsheet anything'

/** localStorage keys. Only UI preferences and the API key live here. */
export const STORAGE_KEYS = {
  apiKey: 'data-agent:deepseek-key',
  model: 'data-agent:model',
  sidebar: 'data-agent:ui:sidebar',
  panel: 'data-agent:ui:panel',
  sidebarWidth: 'data-agent:ui:sidebar-width',
  panelWidth: 'data-agent:ui:panel-width',
  workspaceCache: 'data-agent:workspace-cache',
  telemetry: 'data-agent:ui:telemetry',
} as const

export const DEFAULT_MODEL = 'deepseek-v4-flash'

/** How many rows a single SQL result may return before it is truncated. */
export const MAX_RESULT_ROWS = 60
/** Hard cap on rows rendered inside a chat table. */
export const MAX_PREVIEW_ROWS = 60
export const MAX_SAMPLE_ROWS = 6
export const MAX_AGENT_STEPS = 6
export const MAX_PROFILED_COLUMNS = 160
export const MAX_UPLOAD_BYTES = 80 * 1024 * 1024
export const TRACE_DETAIL_LIMIT = 8000

/** Number of follow-up questions the agent proposes after every answer. */
export const SUGGESTION_COUNT = 4
/** Distinct values sampled per column when building the dataset digest. */
export const DIGEST_TOP_VALUES = 6
/** Columns sampled per table when building the dataset digest. */
export const DIGEST_MAX_COLUMNS = 24
/** Largest tables described in the digest; prevents huge workbooks from hanging. */
export const DIGEST_MAX_TABLES = 12
/** Tables listed in the assistant prompt before summarising the rest. */
export const PROMPT_MAX_TABLES = 30
/** Tables shown in the welcome message. */
export const WELCOME_MAX_TABLES = 5

export const ACCEPTED_EXTENSIONS = ['.csv', '.xlsx'] as const

export const CSV_READ_OPTIONS = 'header = true, sample_size = -1, ignore_errors = true'

/** Statement prefixes the SQL guard allows. Everything else is rejected. */
export const READ_ONLY_STATEMENTS = [
  'SELECT',
  'WITH',
  'DESCRIBE',
  'DESC',
  'SHOW',
  'SUMMARIZE',
  'EXPLAIN',
  'FROM',
  'VALUES',
  'TABLE',
  'PIVOT',
  'UNPIVOT',
  'PRAGMA',
] as const
