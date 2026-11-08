export const APP_NAME = 'Tabula'
export const APP_TAGLINE = 'Conversational analytics over your spreadsheets'

export const STORAGE_KEYS = {
  apiKey: 'data-agent:deepseek-key',
  model: 'data-agent:model',
} as const

export const DEFAULT_MODEL = 'deepseek-v4-flash'

export const MAX_RESULT_ROWS = 250
export const MAX_PREVIEW_ROWS = 120
export const MAX_SAMPLE_ROWS = 6
export const MAX_AGENT_STEPS = 16
export const MAX_PROFILED_COLUMNS = 160
export const MAX_UPLOAD_BYTES = 80 * 1024 * 1024
export const TRACE_DETAIL_LIMIT = 8000

export const ACCEPTED_EXTENSIONS = ['.csv', '.xlsx'] as const

export const CSV_READ_OPTIONS = 'header = true, sample_size = -1, ignore_errors = true'

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
