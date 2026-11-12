/// <reference lib="webworker" />

import type { PythonWorkerRequest, PythonWorkerResponse, PythonExecutionResult } from './types'

const worker = self as unknown as DedicatedWorkerGlobalScope

const PYODIDE_INDEX_URL = 'https://cdn.jsdelivr.net/pyodide/v0.27.2/full/'
const PYODIDE_MODULE_URL = `${PYODIDE_INDEX_URL}pyodide.mjs`

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let pyodideInstance: any = null
let initPromise: Promise<void> | null = null

const PYTHON_HARNESS = `
import sys, io, base64, traceback
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import pandas as pd
import numpy as np

def _format_cell(val):
    if val is None:
        return ''
    if isinstance(val, (list, tuple, dict, set, np.ndarray)):
        return str(val)
    try:
        if pd.isna(val):
            return ''
    except Exception:
        pass
    return str(val)

def __tabula_run__(user_code, csv_content=None):
    old_stdout = sys.stdout
    old_stderr = sys.stderr
    sys.stdout = stdout_io = io.StringIO()
    sys.stderr = stderr_io = io.StringIO()
    
    output_images = []
    execution_error = None
    df_info = None
    df_csv = None
    df_preview = None
    
    try:
        if csv_content is not None and len(csv_content) > 0:
            # Preserve DataFrame across consecutive runs on same data, reload if CSV changed
            if 'df' not in globals() or globals().get('__tabula_last_csv__') != csv_content:
                globals()['df'] = pd.read_csv(io.StringIO(csv_content), skip_blank_lines=False)
                globals()['__tabula_last_csv__'] = csv_content
            
        plt.close('all')
        
        # Execute user code in the global environment
        compiled = compile(user_code, '<input>', 'exec')
        exec(compiled, globals())
        
        # Collect all generated matplotlib figures
        for fig_num in plt.get_fignums():
            fig = plt.figure(fig_num)
            img_buf = io.BytesIO()
            fig.savefig(img_buf, format='png', bbox_inches='tight', dpi=140)
            img_buf.seek(0)
            encoded = 'data:image/png;base64,' + base64.b64encode(img_buf.read()).decode('ascii')
            output_images.append(encoded)
            plt.close(fig)
            
        # Collect updated DataFrame metadata and preview if present
        if 'df' in globals() and isinstance(globals()['df'], pd.DataFrame):
            _target_df = globals()['df']
            df_info = {
                'shape': list(_target_df.shape),
                'columns': [str(c) for c in _target_df.columns]
            }
            try:
                # Generate clean preview and CSV
                preview_sub = _target_df.head(100)
                df_preview = {
                    'columns': [str(c) for c in _target_df.columns],
                    'rows': [[_format_cell(val) for val in row] for row in preview_sub.values],
                    'totalRows': int(_target_df.shape[0]),
                    'totalCols': int(_target_df.shape[1])
                }
                df_csv = _target_df.to_csv(index=False)
            except Exception:
                pass
            
    except Exception:
        execution_error = traceback.format_exc()
    finally:
        sys.stdout = old_stdout
        sys.stderr = old_stderr
        
    return {
        'stdout': stdout_io.getvalue(),
        'stderr': stderr_io.getvalue(),
        'images': output_images,
        'error': execution_error,
        'dfInfo': df_info,
        'dfPreview': df_preview,
        'dfCsv': df_csv
    }
`

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
  const { id, action, code, csvData } = event.data

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
globals().pop('__tabula_last_csv__', None)
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

      const runner = pyodide.globals.get('__tabula_run__')
      const proxyResult = runner(code ?? '', csvData ?? null)
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
