import type { ConvertedSheet } from '../duckdb/excelConvert'
import type { SheetInfo } from '../types'

interface ExcelResponse {
  id: number
  sheets?: ConvertedSheet[]
  info?: SheetInfo[]
  error?: string
}

let requestId = 0

function runWorker<T>(
  action: 'inspect' | 'convert',
  data: ArrayBuffer,
  selectedSheets: string[] | undefined,
  pick: (response: ExcelResponse) => T | undefined,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./excel.worker.ts', import.meta.url), {
      type: 'module',
    })
    const id = ++requestId

    const cleanup = () => worker.terminate()

    worker.onmessage = (event: MessageEvent<ExcelResponse>) => {
      const response = event.data
      if (response.id !== id) return
      cleanup()
      if (response.error) {
        reject(new Error(response.error))
        return
      }
      const picked = pick(response)
      if (picked === undefined) {
        reject(new Error('This workbook could not be read.'))
        return
      }
      resolve(picked)
    }

    worker.onerror = (event) => {
      cleanup()
      reject(new Error(event.message || 'This workbook could not be read.'))
    }

    worker.postMessage({ id, action, data, selectedSheets }, [data])
  })
}

/** Reads sheet metadata before committing to a potentially huge workbook. */
export function inspectWorkbookInWorker(data: ArrayBuffer): Promise<SheetInfo[]> {
  return runWorker('inspect', data, undefined, (response) => response.info)
}

/** Converts only the selected worksheets, or every worksheet when omitted. */
export function convertWorkbookInWorker(
  data: ArrayBuffer,
  selectedSheets?: string[],
): Promise<ConvertedSheet[]> {
  return runWorker('convert', data, selectedSheets, (response) => response.sheets)
}
