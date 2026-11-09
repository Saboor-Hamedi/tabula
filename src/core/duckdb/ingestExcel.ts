import type { DuckDBHandle } from './initDuckDB'
import type { IngestResult, TableSummary } from '../types'
import { CSV_READ_OPTIONS } from '../constants'
import { convertWorkbookInWorker } from '../workers/excelClient'
import { getTableSummary } from './listTables'
import {
  buildSchemaName,
  normalizeIdentifier,
  qualifiedName,
  quoteIdent,
  quoteString,
  uniqueIdentifier,
} from './sql'

export interface IngestExcelInput {
  handle: DuckDBHandle
  file: File
  sessionId: string
  /** Explicit schema for restored/replaced sessions. */
  schemaName?: string
  /** Only import these worksheets; all sheets when omitted. */
  selectedSheets?: string[]
}

/**
 * Ingests every worksheet from an Excel workbook.
 *
 * Workbook parsing happens in a worker; only the resulting CSV text and table
 * creation touch the main thread, so large workbooks do not freeze the UI.
 */
export async function ingestExcel({
  handle,
  file,
  sessionId,
  schemaName: requestedSchema,
  selectedSheets,
}: IngestExcelInput): Promise<IngestResult> {
  const schemaName = requestedSchema ?? buildSchemaName(sessionId)
  const sheets = await convertWorkbookInWorker(await file.arrayBuffer(), selectedSheets)

  await handle.connection.query(`CREATE SCHEMA IF NOT EXISTS ${quoteIdent(schemaName)}`)

  const usedTableNames = new Set<string>()
  const tables: TableSummary[] = []
  const encoder = new TextEncoder()

  for (const [index, sheet] of sheets.entries()) {
    const tableName = uniqueIdentifier(
      normalizeIdentifier(sheet.name, `sheet_${index + 1}`),
      usedTableNames,
    )
    const registeredPath = `upload_${sessionId}_${index}.csv`

    await handle.db.registerFileBuffer(registeredPath, encoder.encode(sheet.csv))
    await handle.connection.query(
      `CREATE TABLE ${qualifiedName(schemaName, tableName)} AS
       SELECT * FROM read_csv_auto(${quoteString(registeredPath)}, ${CSV_READ_OPTIONS})`,
    )

    tables.push(await getTableSummary(handle.connection, schemaName, tableName))
  }

  return {
    tables,
    primaryTable: tables[0]?.name ?? null,
  }
}
