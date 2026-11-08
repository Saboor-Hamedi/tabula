import type { AsyncDuckDBConnection } from '@duckdb/duckdb-wasm'
import type { QueryResult } from '../types'
import { MAX_PREVIEW_ROWS } from '../constants'
import { runSQL } from '../duckdb/runSQL'
import { qualifiedName } from '../duckdb/sql'
import type { DuckDBHandle } from '../duckdb/initDuckDB'

export async function sampleRows(
  handle: DuckDBHandle,
  schemaName: string,
  tableName: string,
  limit = MAX_PREVIEW_ROWS,
): Promise<QueryResult> {
  const safeLimit = Math.max(1, Math.min(limit, MAX_PREVIEW_ROWS))
  return runSQL({
    handle,
    sql: `SELECT * FROM ${qualifiedName(schemaName, tableName)} LIMIT ${safeLimit}`,
    maxRows: safeLimit,
  })
}

export async function countRows(
  connection: AsyncDuckDBConnection,
  schemaName: string,
  tableName: string,
): Promise<number> {
  const result = await connection.query(
    `SELECT COUNT(*) AS row_count FROM ${qualifiedName(schemaName, tableName)}`,
  )
  const first = result.toArray()[0]
  const value = first?.row_count
  if (typeof value === 'bigint') return Number(value)
  if (typeof value === 'number') return value
  return Number(value ?? 0)
}
