import type { AsyncDuckDBConnection } from '@duckdb/duckdb-wasm'
import type { CellValue, ColumnProfile, TableProfile } from '../types'
import { MAX_PROFILED_COLUMNS, MAX_SAMPLE_ROWS } from '../constants'
import { firstNumber, firstScalar } from '../duckdb/result'
import { normalizeCell, qualifiedName, quoteIdent, quoteString } from '../duckdb/sql'
import { tableExists } from '../duckdb/listTables'

interface ColumnRow {
  column_name: string
  data_type: string
}

function isComparableType(dataType: string): boolean {
  const type = dataType.toUpperCase()
  return /^(TINYINT|SMALLINT|INTEGER|BIGINT|HUGEINT|UTINYINT|USMALLINT|UINTEGER|UBIGINT|FLOAT|REAL|DOUBLE|DECIMAL|NUMERIC|VARCHAR|CHAR|TEXT|STRING|BOOL|BOOLEAN|DATE|TIME|TIMESTAMP|TIMESTAMPTZ|TIMETZ|INTERVAL)/.test(
    type,
  )
}

async function collectSamples(
  connection: AsyncDuckDBConnection,
  target: string,
  column: string,
): Promise<CellValue[]> {
  const identifier = quoteIdent(column)
  try {
    const result = await connection.query(
      `SELECT DISTINCT CAST(${identifier} AS VARCHAR) AS sample_value
       FROM ${target}
       WHERE ${identifier} IS NOT NULL
       LIMIT ${MAX_SAMPLE_ROWS}`,
    )
    return result
      .toArray()
      .map((row) => normalizeCell(row.sample_value))
      .filter((value): value is CellValue => value !== null)
  } catch {
    return []
  }
}

async function profileColumn(
  connection: AsyncDuckDBConnection,
  target: string,
  column: string,
  dataType: string,
): Promise<ColumnProfile> {
  const identifier = quoteIdent(column)
  const minMaxSelect = isComparableType(dataType)
    ? `,
       CAST(MIN(${identifier}) AS VARCHAR) AS min_value,
       CAST(MAX(${identifier}) AS VARCHAR) AS max_value`
    : `,
       NULL AS min_value,
       NULL AS max_value`

  let nullCount: number
  let distinctCount = 0
  let min: string | null = null
  let max: string | null = null

  try {
    const result = await connection.query(
      `SELECT
         COUNT(*) FILTER (WHERE ${identifier} IS NULL) AS null_count,
         COUNT(DISTINCT ${identifier}) AS distinct_count${minMaxSelect}
       FROM ${target}`,
    )
    nullCount = firstNumber(result, 'null_count')
    distinctCount = firstNumber(result, 'distinct_count')
    const minValue = normalizeCell(firstScalar(result, 'min_value'))
    const maxValue = normalizeCell(firstScalar(result, 'max_value'))
    min = minValue === null ? null : String(minValue)
    max = maxValue === null ? null : String(maxValue)
  } catch {
    try {
      const fallback = await connection.query(
        `SELECT COUNT(*) FILTER (WHERE ${identifier} IS NULL) AS null_count FROM ${target}`,
      )
      nullCount = firstNumber(fallback, 'null_count')
    } catch {
      nullCount = 0
    }
  }

  return {
    name: column,
    type: dataType,
    nullCount,
    distinctCount,
    min,
    max,
    samples: await collectSamples(connection, target, column),
  }
}

export async function profileTable(
  connection: AsyncDuckDBConnection,
  schemaName: string,
  tableName: string,
): Promise<TableProfile> {
  const exists = await tableExists(connection, schemaName, tableName)
  if (!exists) {
    throw new Error(`Table "${tableName}" was not found in this session.`)
  }

  const target = qualifiedName(schemaName, tableName)

  const countResult = await connection.query(`SELECT COUNT(*) AS row_count FROM ${target}`)
  const rowCount = firstNumber(countResult, 'row_count')

  const columnsResult = await connection.query(
    `SELECT column_name, data_type
     FROM information_schema.columns
     WHERE table_schema = ${quoteString(schemaName)}
       AND table_name = ${quoteString(tableName)}
     ORDER BY ordinal_position`,
  )

  const columnRows = columnsResult.toArray().map((row) => ({
    column_name: String(row.column_name),
    data_type: String(row.data_type),
  })) as ColumnRow[]

  const limited = columnRows.slice(0, MAX_PROFILED_COLUMNS)
  const columns: ColumnProfile[] = []
  for (const column of limited) {
    columns.push(
      await profileColumn(connection, target, column.column_name, column.data_type),
    )
  }

  return {
    table: tableName,
    qualifiedName: target,
    rowCount,
    columnCount: columnRows.length,
    columns,
  }
}
