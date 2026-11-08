import * as XLSX from 'xlsx'
import { normalizeIdentifier, uniqueIdentifier } from './sql'

/** Fully converted worksheet, ready for DuckDB ingestion. */
export interface ConvertedSheet {
  name: string
  csv: string
}

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : ''
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  const text = typeof value === 'string' ? value : String(value)
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function buildColumnNames(headerRow: unknown[], width: number): string[] {
  const used = new Set<string>()
  const names: string[] = []

  for (let index = 0; index < width; index += 1) {
    const rawHeader = headerRow[index]
    const fallback = `column_${index + 1}`
    const headerText =
      rawHeader === null || rawHeader === undefined ? fallback : String(rawHeader).trim()
    const base = normalizeIdentifier(headerText.length > 0 ? headerText : fallback, fallback)
    names.push(uniqueIdentifier(base, used))
  }

  return names
}

function sheetToCsv(sheet: XLSX.WorkSheet): string | null {
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: null,
    raw: true,
    blankrows: false,
  })

  if (matrix.length === 0) return null

  const headerRow = matrix[0] ?? []
  const dataRows = matrix.slice(1)
  const width = dataRows.reduce((max, row) => Math.max(max, row.length), headerRow.length)
  if (width === 0) return null

  const columns = buildColumnNames(headerRow, width)
  const lines: string[] = [columns.map((name) => csvCell(name)).join(',')]

  for (const row of dataRows) {
    const cells: string[] = []
    for (let index = 0; index < width; index += 1) {
      cells.push(csvCell(row[index]))
    }
    lines.push(cells.join(','))
  }

  return lines.join('\n')
}

/** Converts every readable worksheet to CSV. Runs inside a Web Worker. */
export function convertWorkbookToSheets(data: ArrayBuffer): ConvertedSheet[] {
  const workbook = XLSX.read(data, { type: 'array', cellDates: true })
  const sheets: ConvertedSheet[] = []

  for (const name of workbook.SheetNames) {
    const sheet = workbook.Sheets[name]
    if (!sheet) continue
    const csv = sheetToCsv(sheet)
    if (!csv) continue
    sheets.push({ name, csv })
  }

  return sheets
}
