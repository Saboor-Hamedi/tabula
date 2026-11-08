import * as XLSX from 'xlsx'
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
  uniqueIdentifier,
} from './sql'

export interface IngestExcelInput {
  handle: DuckDBHandle
  file: File
  sessionId: string
}

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (value instanceof Date) {
    const text = value.toISOString()
    return text
  }
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : ''
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  const text = typeof value === 'string' ? value : String(value)
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
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

function sheetToCsv(sheet: XLSX.WorkSheet): { csv: string; columnCount: number } | null {
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

  return { csv: lines.join('\n'), columnCount: columns.length }
}

export async function ingestExcel({ handle, file, sessionId }: IngestExcelInput): Promise<IngestResult> {
  const schemaName = buildSchemaName(sessionId)
  const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true })

  await handle.connection.query(`CREATE SCHEMA IF NOT EXISTS ${quoteIdent(schemaName)}`)

  const usedTableNames = new Set<string>()
  const tables: TableSummary[] = []
  const encoder = new TextEncoder()

  for (let index = 0; index < workbook.SheetNames.length; index += 1) {
    const sheetName = workbook.SheetNames[index]
    const sheet = workbook.Sheets[sheetName]
    if (!sheet) continue

    const converted = sheetToCsv(sheet)
    if (!converted) continue

    const tableName = uniqueIdentifier(
      normalizeIdentifier(sheetName, `sheet_${index + 1}`),
      usedTableNames,
    )
    const registeredPath = `upload_${sessionId}_${index}.csv`

    await handle.db.registerFileBuffer(registeredPath, encoder.encode(converted.csv))
    await handle.connection.query(
      `CREATE TABLE ${qualifiedName(schemaName, tableName)} AS
       SELECT * FROM read_csv_auto(${quoteString(registeredPath)}, ${CSV_READ_OPTIONS})`,
    )

    tables.push(await getTableSummary(handle.connection, schemaName, tableName))
  }

  return {
    tables,
    primaryTable: tables[0]?.name ?? null,
  }
}
