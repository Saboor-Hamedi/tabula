import type { ConvertedSheet } from '../duckdb/excelConvert'

interface ExcelResponse {
  id: number
  sheets?: ConvertedSheet[]
  error?: string
}

let requestId = 0

/**
 * Parses a workbook on a dedicated worker so large spreadsheets never block the
 * chat or the upload animation.
 */
export function convertWorkbookInWorker(data: ArrayBuffer): Promise<ConvertedSheet[]> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./excel.worker.ts', import.meta.url), {
      type: 'module',
    })
    const id = ++requestId

    const cleanup = () => {
      worker.terminate()
    }

    worker.onmessage = (event: MessageEvent<ExcelResponse>) => {
      const response = event.data
      if (response.id !== id) return
      cleanup()
      if (response.error || !response.sheets) {
        reject(new Error(response.error ?? 'This workbook could not be read.'))
        return
      }
      resolve(response.sheets)
    }

    worker.onerror = (event) => {
      cleanup()
      reject(new Error(event.message || 'This workbook could not be read.'))
    }

    worker.postMessage({ id, data }, [data])
  })
}
