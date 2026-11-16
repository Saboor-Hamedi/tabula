/// <reference lib="webworker" />

import type { PythonWorkerRequest, PythonWorkerResponse, PythonExecutionResult } from './types'
import { PYTHON_HARNESS } from './pythonHarness'

const worker = self as unknown as DedicatedWorkerGlobalScope

const PYODIDE_INDEX_URL = 'https://cdn.jsdelivr.net/pyodide/v0.27.2/full/'
const PYODIDE_MODULE_URL = `${PYODIDE_INDEX_URL}pyodide.mjs`

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let pyodideInstance: any = null
let initPromise: Promise<void> | null = null

async function getOrInitPyodide(): Promise<any> {
  if (pyodideInstance) return pyodideInstance

  if (!initPromise) {
    initPromise = (async () => {
      try {
        // Load Pyodide ESM module dynamically in module worker
        const pyodideModule = (await import(/* @vite-ignore */ PYODIDE_MODULE_URL)) as {
          loadPyodide: (config: { indexURL: string }) => Promise<any>
        }
        const instance = await pyodideModule.loadPyodide({ indexURL: PYODIDE_INDEX_URL })
        await instance.loadPackage(['numpy', 'pandas', 'matplotlib', 'scipy', 'scikit-learn'])
        await instance.runPythonAsync(PYTHON_HARNESS)
        pyodideInstance = instance
      } catch (err) {
        initPromise = null
        throw err
      }
    })()
  }

  await initPromise
  return pyodideInstance
}

worker.onmessage = async (event: MessageEvent<PythonWorkerRequest>) => {
  const { id, action, code, csvData, extraCsvs } = event.data

  if (action === 'init') {
    try {
      worker.postMessage({ id, type: 'status', status: 'loading' } as PythonWorkerResponse)
      await getOrInitPyodide()
      worker.postMessage({ id, type: 'status', status: 'ready' } as PythonWorkerResponse)
    } catch (error) {
      worker.postMessage({
        id,
        type: 'error',
        status: 'error',
        error: error instanceof Error ? error.message : 'Pyodide initialization failed.',
      } as PythonWorkerResponse)
    }
    return
  }

  if (action === 'reset') {
    try {
      if (pyodideInstance) {
        pyodideInstance.runPython(`
globals().pop('df', None)
globals().pop('dfs', None)
globals().pop('__tabula_last_csv__', None)
for _vf in list(globals().pop('__tabula_virtual_files__', set())):
    try:
        if os.path.exists(_vf):
            os.remove(_vf)
    except Exception:
        pass
`)
      }
      worker.postMessage({ id, type: 'status', status: 'ready' } as PythonWorkerResponse)
    } catch {
      // Ignore reset failure
    }
    return
  }

  if (action === 'run') {
    const startedAt = performance.now()
    try {
      worker.postMessage({ id, type: 'status', status: 'running' } as PythonWorkerResponse)
      const pyodide = await getOrInitPyodide()

      // Dynamically load any extra packages imported by user code (e.g. statsmodels, seaborn, etc.)
      if (code && typeof pyodide.loadPackagesFromImports === 'function') {
        try {
          await pyodide.loadPackagesFromImports(code)
        } catch {
          // Continue even if package scanning encounters unlisted package
        }
      }

      // pandas.ExcelWriter / to_excel / read_excel lazily import openpyxl inside pandas
      if (code && /\b(openpyxl|to_excel|read_excel|ExcelWriter)\b/.test(code)) {
        try {
          await pyodide.loadPackage('openpyxl')
        } catch {
          // Continue if offline or unavailable
        }
      }

      const runner = pyodide.globals.get('__tabula_run__')
      const extraProxy = extraCsvs ? pyodide.toPy(extraCsvs) : null
      const proxyResult = runner(code ?? '', csvData ?? null, extraProxy)
      if (extraProxy && typeof extraProxy.destroy === 'function') extraProxy.destroy()
      const jsResult = proxyResult.toJs({ dict_converter: Object.fromEntries })
      proxyResult.destroy()

      const elapsedMs = Math.round(performance.now() - startedAt)

      const executionResult: PythonExecutionResult = {
        code: code ?? '',
        stdout: typeof jsResult.stdout === 'string' ? jsResult.stdout : '',
        stderr: typeof jsResult.stderr === 'string' ? jsResult.stderr : '',
        images: Array.isArray(jsResult.images) ? jsResult.images : [],
        elapsedMs,
        error: typeof jsResult.error === 'string' ? jsResult.error : null,
        executedAt: Date.now(),
        dfInfo:
          jsResult.dfInfo && Array.isArray(jsResult.dfInfo.shape)
            ? {
                shape: [Number(jsResult.dfInfo.shape[0]), Number(jsResult.dfInfo.shape[1])],
                columns: Array.isArray(jsResult.dfInfo.columns) ? jsResult.dfInfo.columns : [],
              }
            : undefined,
        dfCsv: typeof jsResult.dfCsv === 'string' ? jsResult.dfCsv : undefined,
        dfPreview:
          jsResult.dfPreview && Array.isArray(jsResult.dfPreview.columns)
            ? {
                columns: jsResult.dfPreview.columns.map(String),
                rows: Array.isArray(jsResult.dfPreview.rows)
                  ? jsResult.dfPreview.rows.map((r: unknown[]) =>
                      Array.isArray(r) ? r.map(String) : [],
                    )
                  : [],
                totalRows: Number(jsResult.dfPreview.totalRows ?? 0),
                totalCols: Number(jsResult.dfPreview.totalCols ?? 0),
              }
            : undefined,
      }

      worker.postMessage({
        id,
        type: 'result',
        status: executionResult.error ? 'error' : 'ready',
        result: executionResult,
      } as PythonWorkerResponse)
    } catch (error) {
      const elapsedMs = Math.round(performance.now() - startedAt)
      worker.postMessage({
        id,
        type: 'result',
        status: 'error',
        result: {
          code: code ?? '',
          stdout: '',
          stderr: '',
          images: [],
          elapsedMs,
          error: error instanceof Error ? error.message : 'Execution failed.',
          executedAt: Date.now(),
        },
        error: error instanceof Error ? error.message : 'Execution failed.',
      } as PythonWorkerResponse)
    }
  }
}
