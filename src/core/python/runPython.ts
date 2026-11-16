import type { AsyncDuckDBConnection } from '@duckdb/duckdb-wasm'
import { executePythonInWorker } from './initPython'
import { exportTableToCsv } from './exportTableCsv'
import type { PythonExecutionResult } from './types'

export interface RunPythonOptions {
  connection?: AsyncDuckDBConnection | null
  schemaName?: string
  tableName?: string
  csvData?: string
  extraDatasets?: Array<{ key: string; schemaName: string; tableName: string }>
}

/**
 * Executes a Python script with the active table pre-loaded as pandas DataFrame `df`
 * (and optional `extraDatasets` pre-loaded in `dfs` dict).
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

  let extraCsvs: Record<string, string> | undefined
  if (options?.connection && options.extraDatasets && options.extraDatasets.length > 0) {
    const map: Record<string, string> = {}
    for (const ds of options.extraDatasets) {
      try {
        map[ds.key] = await exportTableToCsv(options.connection, ds.schemaName, ds.tableName)
      } catch {
        // Skip failed dataset export
      }
    }
    if (Object.keys(map).length > 0) {
      extraCsvs = map
    }
  }

  return executePythonInWorker(trimmed, csv, options?.tableName, extraCsvs)
}
