/// <reference lib="webworker" />

import { convertWorkbookToSheets, inspectWorkbook } from '../duckdb/excelConvert'
import type { SheetInfo } from '../types'

interface ExcelRequest {
  id: number
  action: 'inspect' | 'convert'
  data: ArrayBuffer
  selectedSheets?: string[]
}

interface ExcelResponse {
  id: number
  sheets?: ReturnType<typeof convertWorkbookToSheets>
  info?: SheetInfo[]
  error?: string
}

const worker = self as unknown as DedicatedWorkerGlobalScope

worker.onmessage = (event: MessageEvent<ExcelRequest>) => {
  const { id, action, data, selectedSheets } = event.data
  try {
    if (action === 'inspect') {
      const response: ExcelResponse = { id, info: inspectWorkbook(data) }
      worker.postMessage(response)
      return
    }

    const response: ExcelResponse = {
      id,
      sheets: convertWorkbookToSheets(data, selectedSheets),
    }
    worker.postMessage(response)
  } catch (error) {
    const response: ExcelResponse = {
      id,
      error: error instanceof Error ? error.message : 'This workbook could not be read.',
    }
    worker.postMessage(response)
  }
}
