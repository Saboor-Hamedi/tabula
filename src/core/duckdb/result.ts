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

export function tableToRawRows(table: ArrowTableLike | null | undefined): RawRow[] {
  if (!table || typeof table.toArray !== 'function') return []
  const rows = table.toArray() as JsonRow[]
  if (!Array.isArray(rows)) return []

  const output: RawRow[] = []
  for (const row of rows) {
    if (row && typeof row.toJSON === 'function') output.push(row.toJSON())
  }
  return output
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

export function tableColumns(table: ArrowTableLike | null | undefined): string[] {
  const fields = table?.schema?.fields
  return Array.isArray(fields) ? fields.map((field) => field.name) : []
}

export function firstScalar(table: ArrowTableLike, column: string): unknown {
  const rows = tableToRawRows(table)
  if (rows.length === 0) return null
  return rows[0][column] ?? null
}

export function firstNumber(table: ArrowTableLike, column: string): number {
  return toSafeNumber(firstScalar(table, column))
}
