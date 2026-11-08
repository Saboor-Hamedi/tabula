/// <reference lib="webworker" />

import { convertWorkbookToSheets } from '../duckdb/excelConvert'

interface ExcelRequest {
  id: number
  data: ArrayBuffer
}

interface ExcelResponse {
  id: number
  sheets?: ReturnType<typeof convertWorkbookToSheets>
  error?: string
}

const worker = self as unknown as DedicatedWorkerGlobalScope

worker.onmessage = (event: MessageEvent<ExcelRequest>) => {
  const { id, data } = event.data
  try {
    const sheets = convertWorkbookToSheets(data)
    const response: ExcelResponse = { id, sheets }
    worker.postMessage(response)
  } catch (error) {
    const response: ExcelResponse = {
      id,
      error: error instanceof Error ? error.message : 'This workbook could not be read.',
    }
    worker.postMessage(response)
  }
}
