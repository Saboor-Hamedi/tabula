import type { DuckDBHandle } from './initDuckDB'
import type { IngestResult, TableSummary } from '../types'
import { CSV_READ_OPTIONS } from '../constants'
import { getTableSummary } from './listTables'
import {
  buildSchemaName,
  normalizeIdentifier,
  qualifiedName,
  quoteIdent,
  quoteString,
  stripFileName,
} from './sql'

export interface IngestCSVInput {
  handle: DuckDBHandle
  file: File
  sessionId: string
}

export async function ingestCSV({ handle, file, sessionId }: IngestCSVInput): Promise<IngestResult> {
  const schemaName = buildSchemaName(sessionId)
  const registeredPath = `upload_${sessionId}.csv`
  const bytes = new Uint8Array(await file.arrayBuffer())

  await handle.db.registerFileBuffer(registeredPath, bytes)
  await handle.connection.query(`CREATE SCHEMA IF NOT EXISTS ${quoteIdent(schemaName)}`)

  const tableName = normalizeIdentifier(stripFileName(file.name), 'data')
  const target = qualifiedName(schemaName, tableName)

  await handle.connection.query(
    `CREATE TABLE ${target} AS
     SELECT * FROM read_csv_auto(${quoteString(registeredPath)}, ${CSV_READ_OPTIONS})`,
  )

  const summary: TableSummary = await getTableSummary(handle.connection, schemaName, tableName)

  return {
    tables: [summary],
    primaryTable: tableName,
  }
}
