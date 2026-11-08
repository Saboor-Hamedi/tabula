import type { CellValue } from '../types'
import { normalizeCell, toSafeNumber } from './sql'

export type RawRow = Record<string, unknown>

interface JsonRow {
  toJSON(): RawRow
}

interface ArrowTableLike {
  numRows: number
  schema: { fields: ReadonlyArray<{ name: string }> }
  toArray(): unknown[]
  slice(begin: number, end?: number): ArrowTableLike
}

export function tableToRawRows(table: ArrowTableLike): RawRow[] {
  const rows = table.toArray() as JsonRow[]
  return rows.map((row) => row.toJSON())
}

export function tableToRows(table: ArrowTableLike): Array<Record<string, CellValue>> {
  return tableToRawRows(table).map((row) => {
    const normalized: Record<string, CellValue> = {}
    for (const [key, value] of Object.entries(row)) {
      normalized[key] = normalizeCell(value)
    }
    return normalized
  })
}

export function tableColumns(table: ArrowTableLike): string[] {
  return table.schema.fields.map((field) => field.name)
}

export function firstScalar(table: ArrowTableLike, column: string): unknown {
  const rows = tableToRawRows(table)
  if (rows.length === 0) return null
  return rows[0][column] ?? null
}

export function firstNumber(table: ArrowTableLike, column: string): number {
  return toSafeNumber(firstScalar(table, column))
}
