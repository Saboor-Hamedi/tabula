/**
 * Types for the Python execution engine.
 */

export type PythonStatus = 'idle' | 'loading' | 'ready' | 'running' | 'error'

export interface PythonExecutionResult {
  code: string
  stdout: string
  stderr: string
  images: string[]
  elapsedMs: number
  error: string | null
  executedAt: number
  dfInfo?: {
    shape: [number, number]
    columns: string[]
  }
  dfPreview?: {
    columns: string[]
    rows: string[][]
    totalRows: number
    totalCols: number
  }
  dfCsv?: string
}

export interface PythonWorkerRequest {
  id: number
  action: 'init' | 'run' | 'reset'
  code?: string
  csvData?: string
  tableName?: string
}

export interface PythonWorkerResponse {
  id: number
  type: 'status' | 'result' | 'error'
  status?: PythonStatus
  result?: PythonExecutionResult
  error?: string
  message?: string
}
