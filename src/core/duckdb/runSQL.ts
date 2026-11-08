import type { DuckDBHandle } from './initDuckDB'
import type { QueryResult } from '../types'
import { MAX_RESULT_ROWS } from '../constants'
import { tableColumns, tableToRows } from './result'
import { assertReadOnlySql, quoteString } from './sql'

export interface RunSQLInput {
  handle: DuckDBHandle
  sql: string
  schemaName?: string
  maxRows?: number
  readOnly?: boolean
}

export async function runSQL({
  handle,
  sql,
  schemaName,
  maxRows = MAX_RESULT_ROWS,
  readOnly = false,
}: RunSQLInput): Promise<QueryResult> {
  const trimmed = sql.trim()
  if (!trimmed) {
    throw new Error('SQL statement is empty.')
  }

  if (readOnly) {
    assertReadOnlySql(trimmed)
  }

  if (schemaName) {
    await handle.connection.query(`SET search_path = ${quoteString(schemaName)}`)
  }

  const startedAt = performance.now()
  const table = await handle.connection.query(trimmed)
  const elapsedMs = Math.round(performance.now() - startedAt)

  if (!table || typeof table.numRows !== 'number') {
    throw new Error('DuckDB returned an unreadable result for this query.')
  }

  const totalRows = table.numRows
  const limited = totalRows > maxRows ? table.slice(0, maxRows) : table

  const rows = tableToRows(limited)
  return {
    columns: tableColumns(limited),
    rows,
    rowCount: totalRows,
    returnedRows: rows.length,
    truncated: totalRows > maxRows,
    elapsedMs,
  }
}
