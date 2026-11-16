/// <reference lib="webworker" />

import type { PythonWorkerRequest, PythonWorkerResponse, PythonExecutionResult } from './types'

const worker = self as unknown as DedicatedWorkerGlobalScope

const PYODIDE_INDEX_URL = 'https://cdn.jsdelivr.net/pyodide/v0.27.2/full/'
const PYODIDE_MODULE_URL = `${PYODIDE_INDEX_URL}pyodide.mjs`

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let pyodideInstance: any = null
let initPromise: Promise<void> | null = null

const PYTHON_HARNESS = `
import sys, io, base64, traceback, math
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.axes import Axes as _MplAxes
import pandas as pd
import numpy as np

def _sanitize_lim_arg(val):
    if val is None:
        return None
    if isinstance(val, (int, float, np.floating, np.integer)):
        f = float(val)
        return f if math.isfinite(f) else None
    return val

_orig_set_ylim = _MplAxes.set_ylim
def _safe_set_ylim(self, bottom=None, top=None, *, emit=True, auto=False, ymin=None, ymax=None):
    if isinstance(bottom, (tuple, list, np.ndarray)) and len(bottom) == 2 and top is None:
        bottom, top = bottom[0], bottom[1]
    if ymin is not None and bottom is None:
        bottom = ymin
    if ymax is not None and top is None:
        top = ymax
    b = _sanitize_lim_arg(bottom)
    t = _sanitize_lim_arg(top)
    if b is None and t is None and (bottom is not None or top is not None):
        return self.get_ylim()
    return _orig_set_ylim(self, bottom=b, top=t, emit=emit, auto=auto)

_orig_set_xlim = _MplAxes.set_xlim
def _safe_set_xlim(self, left=None, right=None, *, emit=True, auto=False, xmin=None, xmax=None):
    if isinstance(left, (tuple, list, np.ndarray)) and len(left) == 2 and right is None:
        left, right = left[0], left[1]
    if xmin is not None and left is None:
        left = xmin
    if xmax is not None and right is None:
        right = xmax
    l = _sanitize_lim_arg(left)
    r = _sanitize_lim_arg(right)
    if l is None and r is None and (left is not None or right is not None):
        return self.get_xlim()
    return _orig_set_xlim(self, left=l, right=r, emit=emit, auto=auto)

_MplAxes.set_ylim = _safe_set_ylim
_MplAxes.set_xlim = _safe_set_xlim

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

def __tabula_run__(user_code, csv_content=None, extra_csvs=None):
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

        if extra_csvs is not None:
            _dfs = globals().get('dfs')
            if not isinstance(_dfs, dict):
                _dfs = {}
            _extra_dict = extra_csvs.to_py() if hasattr(extra_csvs, 'to_py') else dict(extra_csvs)
            for _k, _v in _extra_dict.items():
                if _v is not None and len(_v) > 0:
                    _dfs[str(_k)] = pd.read_csv(io.StringIO(_v), skip_blank_lines=False)
            globals()['dfs'] = _dfs
            if 'df' not in globals() and len(_dfs) > 0:
                globals()['df'] = next(iter(_dfs.values()))
            
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
