import type { AsyncDuckDBConnection } from '@duckdb/duckdb-wasm'
import { executePythonInWorker } from './initPython'
import { exportTableToCsv } from './exportTableCsv'
import type { PythonExecutionResult } from './types'

export interface RunPythonOptions {
  connection?: AsyncDuckDBConnection | null
  schemaName?: string
  tableName?: string
  csvData?: string
}

/**
 * Executes a Python script with the active table pre-loaded as pandas DataFrame `df`.
 */
export async function runPython(
  code: string,
  options?: RunPythonOptions,
): Promise<PythonExecutionResult> {
  const trimmed = code.trim()
  if (!trimmed) {
    return {
      code: '',
      stdout: '',
      stderr: '',
      images: [],
      elapsedMs: 0,
      error: 'Python code is empty.',
      executedAt: Date.now(),
    }
  }

  let csv = options?.csvData

  if (!csv && options?.connection && options.schemaName && options.tableName) {
    try {
      csv = await exportTableToCsv(options.connection, options.schemaName, options.tableName)
    } catch {
      // Continue even if table CSV export fails; user may run pure math or scripts
    }
  }

  return executePythonInWorker(trimmed, csv, options?.tableName)
}
