import type { AsyncDuckDBConnection } from '@duckdb/duckdb-wasm'
import type { DatasetDigest, DigestColumn, DigestTable, Session } from '../types'
import { DIGEST_MAX_COLUMNS, DIGEST_MAX_TABLES, DIGEST_TOP_VALUES } from '../constants'
import { firstNumber } from '../duckdb/result'
import { qualifiedName, quoteIdent, quoteString } from '../duckdb/sql'

/**
 * Builds a compact digest of a session: for every table, the columns with their
 * types, cardinality, and the most frequent values.
 *
 * This is the input to the suggestion engine. It is deliberately cheap (one
 * aggregate query per column, capped) because it runs right after ingestion and
 * after every answer. The digest is what lets the agent propose questions like
 * "Which region drives the 62% of revenue from EMEA?" instead of a static list.
 */

/** Column types we can safely aggregate with MIN/MAX and GROUP BY. */
function isGroupable(type: string): boolean {
  return !/BLOB|BYTEA|BINARY|STRUCT|LIST|MAP|UNION|ARRAY/i.test(type)
}

function isNumeric(type: string): boolean {
  return /INT|DECIMAL|NUMERIC|DOUBLE|FLOAT|REAL|HUGEINT/i.test(type)
}

function isTemporal(type: string): boolean {
  return /DATE|TIME/i.test(type)
}

function isBoolean(type: string): boolean {
  return /^BOOL/i.test(type)
}

/** Reads the ordered column list for one table. */
async function readColumns(
  connection: AsyncDuckDBConnection,
  schemaName: string,
  tableName: string,
): Promise<Array<{ name: string; type: string }>> {
  const result = await connection.query(
    `SELECT column_name, data_type
     FROM information_schema.columns
     WHERE table_schema = ${quoteString(schemaName)}
       AND table_name = ${quoteString(tableName)}
     ORDER BY ordinal_position`,
  )

  return result.toArray().map((row) => ({
    name: String(row.column_name),
    type: String(row.data_type),
  }))
}

/** Cardinality plus the most common values for a single column. */
async function describeColumn(
  connection: AsyncDuckDBConnection,
  target: string,
  name: string,
  type: string,
): Promise<DigestColumn> {
  const identifier = quoteIdent(name)

  if (!isGroupable(type)) {
    return { name, type, distinctCount: 0, topValues: [] }
  }

  try {
    const result = await connection.query(
      `SELECT
         COUNT(DISTINCT ${identifier}) AS distinct_count
       FROM ${target}`,
    )
    const distinctCount = firstNumber(result, 'distinct_count')

    // Only sample values for columns with a readable number of categories.
    // A high-cardinality free-text column would produce noise, not insight.
    const worthSampling = distinctCount > 0 && distinctCount <= 200
    if (!worthSampling) {
      return { name, type, distinctCount, topValues: [] }
    }

    const valuesResult = await connection.query(
      `SELECT CAST(${identifier} AS VARCHAR) AS value, COUNT(*) AS n
       FROM ${target}
       WHERE ${identifier} IS NOT NULL
       GROUP BY 1
       ORDER BY n DESC
       LIMIT ${DIGEST_TOP_VALUES}`,
    )

    const topValues = valuesResult
      .toArray()
      .map((row) => String(row.value ?? '').trim())
      .filter((value) => value.length > 0 && value.length <= 48)

    return { name, type, distinctCount, topValues }
  } catch {
    return { name, type, distinctCount: 0, topValues: [] }
  }
}

/**
 * Builds a digest for the most useful tables in a session.
 *
 * Workbooks can contain hundreds of sheets. Profiling every one would take a
 * long time and flood the assistant with noise, so the primary table plus the
 * largest tables are described first.
 */
export async function buildDatasetDigest(
  connection: AsyncDuckDBConnection,
  session: Session,
): Promise<DatasetDigest> {
  const primary = session.tables.find((table) => table.name === session.primaryTable)
  const ranked = [...session.tables]
    .filter((table) => table.name !== primary?.name)
    .sort(
      (left, right) =>
        right.rowCount - left.rowCount || right.columnCount - left.columnCount,
    )
  const selected = [primary, ...ranked].filter(
    (table): table is Session['tables'][number] => table !== undefined,
  )
  const tables: DigestTable[] = []

  for (const table of selected.slice(0, DIGEST_MAX_TABLES)) {
    const target = qualifiedName(session.schemaName, table.name)

    try {
      const columns = await readColumns(connection, session.schemaName, table.name)
      const described: DigestColumn[] = []

      for (const column of columns.slice(0, DIGEST_MAX_COLUMNS)) {
        described.push(await describeColumn(connection, target, column.name, column.type))
      }

      tables.push({
        name: table.name,
        rowCount: table.rowCount,
        columns: described,
      })
    } catch {
      tables.push({ name: table.name, rowCount: table.rowCount, columns: [] })
    }
  }

  return { tables }
}

/** True when a column is a good candidate for a time trend. */
export function isTemporalColumn(column: DigestColumn): boolean {
  return isTemporal(column.type)
}

/**
 * True when a column is a numeric measure, not an identifier.
 *
 * This is the difference between a useful question and a nonsense one. A column
 * called `order_id` is a bigint, but summing it is meaningless. We reject:
 *  - names that are an id (`id`, `order_id`, `customerid`),
 *  - columns whose distinct count equals the row count (a unique key),
 *  - obvious codes and years.
 */
export function isNumericColumn(column: DigestColumn): boolean {
  if (!isNumeric(column.type)) return false
  if (/(^|_)id$/i.test(column.name) || /^id$/i.test(column.name)) return false
  if (/(^|_)(code|zip|postal|phone|year|yr)$/i.test(column.name)) return false
  return true
}

/** True when a column is a good candidate for a grouping/dimension. */
export function isCategoricalColumn(column: DigestColumn): boolean {
  if (isBoolean(column.type)) return true
  if (!isGroupable(column.type)) return false
  if (/(^|_)id$/i.test(column.name) || /^id$/i.test(column.name)) return false
  return column.distinctCount > 1 && column.distinctCount <= 60
}
