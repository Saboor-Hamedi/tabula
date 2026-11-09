import type { AsyncDuckDBConnection } from '@duckdb/duckdb-wasm'
import { qualifiedName } from '../duckdb/sql'

function escapeCsvValue(val: unknown): string {
  if (val === null || val === undefined) return ''
  if (typeof val === 'bigint') return val.toString()
  if (val instanceof Date) return val.toISOString()
  if (typeof val === 'object') {
    try {
      return `"${JSON.stringify(val).replace(/"/g, '""')}"`
    } catch {
      return String(val)
    }
  }
  const str = String(val)
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

/**
 * Extracts a table from DuckDB as a CSV text string, ready to be read by pandas.
 */
export async function exportTableToCsv(
  connection: AsyncDuckDBConnection,
  schemaName: string,
  tableName: string,
  maxRows = 50_000,
): Promise<string> {
  const target = qualifiedName(schemaName, tableName)
  const result = await connection.query(`SELECT * FROM ${target} LIMIT ${maxRows}`)

  const fields = result.schema?.fields ?? []
  const headers = fields.map((f) => f.name)
  const lines: string[] = [headers.map(escapeCsvValue).join(',')]

  const rows = result.toArray()
  for (const row of rows) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r =
      row && typeof (row as any).toJSON === 'function'
        ? (row as any).toJSON()
        : (row as Record<string, unknown> | null)
    if (r) {
      lines.push(headers.map((h) => escapeCsvValue(r[h])).join(','))
    }
  }

  return lines.join('\n')
}
