import type { AsyncDuckDBConnection } from '@duckdb/duckdb-wasm'
import type { TableSummary } from '../types'
import { firstNumber, firstScalar } from './result'
import { qualifiedName, quoteString } from './sql'

export async function getTableSummary(
  connection: AsyncDuckDBConnection,
  schemaName: string,
  tableName: string,
): Promise<TableSummary> {
  const countResult = await connection.query(
    `SELECT COUNT(*) AS row_count FROM ${qualifiedName(schemaName, tableName)}`,
  )
  const rowCount = firstNumber(countResult, 'row_count')

  const columnResult = await connection.query(
    `SELECT COUNT(*) AS column_count
     FROM information_schema.columns
     WHERE table_schema = ${quoteString(schemaName)}
       AND table_name = ${quoteString(tableName)}`,
  )
  const columnCount = firstNumber(columnResult, 'column_count')

  return { name: tableName, rowCount, columnCount }
}

export async function listTables(
  connection: AsyncDuckDBConnection,
  schemaName: string,
): Promise<TableSummary[]> {
  const result = await connection.query(
    `SELECT table_name
     FROM information_schema.tables
     WHERE table_schema = ${quoteString(schemaName)}
       AND table_type IN ('BASE TABLE', 'VIEW')
     ORDER BY table_name`,
  )

  const names = result
    .toArray()
    .map((row) => String(row.table_name))
    .filter((name) => name.length > 0)

  const summaries: TableSummary[] = []
  for (const name of names) {
    summaries.push(await getTableSummary(connection, schemaName, name))
  }
  return summaries
}

export async function tableExists(
  connection: AsyncDuckDBConnection,
  schemaName: string,
  tableName: string,
): Promise<boolean> {
  const result = await connection.query(
    `SELECT 1 AS present
     FROM information_schema.tables
     WHERE table_schema = ${quoteString(schemaName)}
       AND table_name = ${quoteString(tableName)}
     LIMIT 1`,
  )
  return firstScalar(result, 'present') !== null
}
