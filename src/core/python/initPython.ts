import type {
  PythonExecutionResult,
  PythonStatus,
  PythonWorkerRequest,
  PythonWorkerResponse,
} from './types'

let workerInstance: Worker | null = null
let currentStatus: PythonStatus = 'idle'
const statusListeners = new Set<(status: PythonStatus) => void>()
let requestId = 0

function updateStatus(next: PythonStatus) {
  if (currentStatus === next) return
  currentStatus = next
  for (const listener of statusListeners) {
    try {
      listener(next)
    } catch {
      // Ignore listener errors
    }
  }
}

export function getPythonStatus(): PythonStatus {
  return currentStatus
}

export function subscribePythonStatus(listener: (status: PythonStatus) => void): () => void {
  statusListeners.add(listener)
  listener(currentStatus)
  return () => {
    statusListeners.delete(listener)
  }
}

export function getOrCreatePythonWorker(): Worker {
  if (workerInstance) return workerInstance

  workerInstance = new Worker(new URL('./python.worker.ts', import.meta.url), {
    type: 'module',
  })

  workerInstance.onmessage = (event: MessageEvent<PythonWorkerResponse>) => {
    if (event.data.status) {
      updateStatus(event.data.status)
    }
  }

  workerInstance.onerror = (err) => {
    console.error('Python Worker Error:', err)
    updateStatus('error')
    terminatePythonEngine()
  }

  return workerInstance
}

export function terminatePythonEngine(): void {
  if (workerInstance) {
    workerInstance.terminate()
    workerInstance = null
    updateStatus('idle')
  }
}

/** Pre-warms the Python engine in the background without running user code. */
export function preloadPythonEngine(): void {
  if (currentStatus === 'ready' || currentStatus === 'loading' || currentStatus === 'running') return
  const worker = getOrCreatePythonWorker()
  const id = ++requestId
  worker.postMessage({ id, action: 'init' } as PythonWorkerRequest)
}

/** Resets the Python environment variables and dataframe cache. */
export function resetPythonEngine(): void {
  if (!workerInstance) return
  const id = ++requestId
  workerInstance.postMessage({ id, action: 'reset' } as PythonWorkerRequest)
}

/** Executes Python code in the Pyodide Web Worker. */
export function executePythonInWorker(
  code: string,
  csvData?: string,
  tableName?: string,
): Promise<PythonExecutionResult> {
  return new Promise((resolve, reject) => {
    const worker = getOrCreatePythonWorker()
    const id = ++requestId

    const timeoutTimer = window.setTimeout(() => {
      worker.removeEventListener('message', handleMessage)
      updateStatus('error')
      reject(new Error('Python execution timed out (limit: 60s).'))
    }, 60_000)

    const handleMessage = (event: MessageEvent<PythonWorkerResponse>) => {
      if (event.data.id !== id) return

      if (event.data.type === 'status' && event.data.status) {
        updateStatus(event.data.status)
        return
      }

      window.clearTimeout(timeoutTimer)
      worker.removeEventListener('message', handleMessage)

      if (event.data.type === 'result' && event.data.result) {
        updateStatus(event.data.result.error ? 'error' : 'ready')
        resolve(event.data.result)
      } else {
        updateStatus('error')
        reject(new Error(event.data.error || 'Python execution failed.'))
      }
    }

    worker.addEventListener('message', handleMessage)
    worker.postMessage({
      id,
      action: 'run',
      code,
      csvData,
      tableName,
    } as PythonWorkerRequest)
  })
}
