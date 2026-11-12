import * as XLSX from 'xlsx'
import type { ColumnProfileStats, SelectionRange, SelectionSummary, StaticSheetData } from './types'

/** Converts a 0-based column index to Excel-style column letters (0 -> A, 26 -> AA). */
export function toExcelColumnLetter(index: number): string {
  let n = index
  let result = ''
  while (n >= 0) {
    result = String.fromCharCode((n % 26) + 65) + result
    n = Math.floor(n / 26) - 1
  }
  return result
}

export function formatCellRef(rowIndex: number, colIndex: number): string {
  return `${toExcelColumnLetter(colIndex)}${rowIndex + 1}`
}

export function normalizeRange(range: SelectionRange) {
  return {
    minRow: Math.min(range.start.row, range.end.row),
    maxRow: Math.max(range.start.row, range.end.row),
    minCol: Math.min(range.start.col, range.end.col),
    maxCol: Math.max(range.start.col, range.end.col),
  }
}

export function formatRangeLabel(range: SelectionRange | null): string {
  if (!range) return 'A1'
  const { minRow, maxRow, minCol, maxCol } = normalizeRange(range)
  const startRef = formatCellRef(minRow, minCol)
  if (minRow === maxRow && minCol === maxCol) return startRef
  return `${startRef}:${formatCellRef(maxRow, maxCol)}`
}

/** Parses a CSV string cleanly using SheetJS so quoted commas/newlines stay intact. */
export function parseCsvToGrid(csv: string): { headers: string[]; rows: string[][] } {
  if (!csv || !csv.trim()) return { headers: [], rows: [] }
  const wb = XLSX.read(csv, { type: 'string', raw: true })
  const firstSheetName = wb.SheetNames[0]
  if (!firstSheetName) return { headers: [], rows: [] }
  const sheet = wb.Sheets[firstSheetName]
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' })
  if (matrix.length === 0) return { headers: [], rows: [] }

  const headers = matrix[0].map((cell, idx) => {
    const str = cell === null || cell === undefined ? '' : String(cell).trim()
    return str || `Column ${idx + 1}`
  })
  const rows = matrix.slice(1).map((row) =>
    headers.map((_h, colIdx) => {
      const val = row[colIdx]
      return val === null || val === undefined ? '' : String(val)
    }),
  )
  return { headers, rows }
}

function sanitizeSheetName(name: string, used: Set<string>): string {
  // Excel sheet names must be <= 31 chars and omit \ / ? * [ ] :
  const base = (name || 'Sheet1')
    .replace(/[\\/?*[\]:]/g, '_')
    .trim()
    .slice(0, 31) || 'Sheet'
  let candidate = base
  let counter = 2
  while (used.has(candidate.toLowerCase())) {
    const suffix = `_${counter}`
    candidate = `${base.slice(0, 31 - suffix.length)}${suffix}`
    counter += 1
  }
  used.add(candidate.toLowerCase())
  return candidate
}

function coerceExcelCell(value: string): string | number | boolean {
  const trimmed = value.trim()
  if (!trimmed) return ''
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    const num = Number(trimmed)
    if (Number.isFinite(num) && Math.abs(num) < 1e15) return num
  }
  return value
}

/** Builds and downloads a real multi-sheet Excel (.xlsx) file with auto-fitted columns. */
export function exportSheetsToXlsx(fileName: string, sheets: StaticSheetData[]): void {
  const wb = XLSX.utils.book_new()
  const usedNames = new Set<string>()

  for (const sheetData of sheets) {
    const safeName = sanitizeSheetName(sheetData.name, usedNames)
    const aoa: Array<Array<string | number | boolean>> = [
      sheetData.headers,
      ...sheetData.rows.map((row) =>
        sheetData.headers.map((_h, cIdx) => coerceExcelCell(row[cIdx] ?? '')),
      ),
    ]
    const ws = XLSX.utils.aoa_to_sheet(aoa)

    // Auto-size columns cleanly (capped between 10 and 48 chars)
    ws['!cols'] = sheetData.headers.map((header, cIdx) => {
      let maxLen = header.length
      const sampleLimit = Math.min(sheetData.rows.length, 250)
      for (let r = 0; r < sampleLimit; r++) {
        const cellLen = (sheetData.rows[r]?.[cIdx] ?? '').length
        if (cellLen > maxLen) maxLen = cellLen
      }
      return { wch: Math.min(Math.max(maxLen + 3, 10), 48) }
    })

    // Enable Excel AutoFilter across header row
    if (sheetData.headers.length > 0) {
      const lastCol = toExcelColumnLetter(sheetData.headers.length - 1)
      const lastRow = Math.max(sheetData.rows.length + 1, 1)
      ws['!autofilter'] = { ref: `A1:${lastCol}${lastRow}` }
    }

    XLSX.utils.book_append_sheet(wb, ws, safeName)
  }

  const outName = fileName.toLowerCase().endsWith('.xlsx') ? fileName : `${fileName}.xlsx`
  XLSX.writeFile(wb, outName)
}

function parseSortableNumber(raw: string): number | null {
  const cleaned = raw.trim().replace(/^[$€£₨¥]/, '').replace(/,/g, '').replace(/%$/, '')
  if (!cleaned || !/^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(cleaned)) return null
  const num = Number(cleaned)
  return Number.isFinite(num) ? num : null
}

/** Smart Excel comparator: empty cells always sink last; numeric & date values sort naturally. */
export function compareCells(aRaw: string, bRaw: string, direction: 'asc' | 'desc'): number {
  const a = (aRaw ?? '').trim()
  const b = (bRaw ?? '').trim()
  const aEmpty = a === '' || a === '—' || a.toLowerCase() === 'null'
  const bEmpty = b === '' || b === '—' || b.toLowerCase() === 'null'

  if (aEmpty && bEmpty) return 0
  if (aEmpty) return 1
  if (bEmpty) return -1

  const aNum = parseSortableNumber(a)
  const bNum = parseSortableNumber(b)
  let cmp = 0
  if (aNum !== null && bNum !== null) {
    cmp = aNum - bNum
  } else {
    cmp = a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
  }
  return direction === 'asc' ? cmp : -cmp
}

/** Computes Excel-style bottom-bar selection math over a rectangular range of cells. */
export function computeSelectionSummary(
  rows: string[][],
  range: SelectionRange | null,
): SelectionSummary {
  if (!range || rows.length === 0) {
    return { cellCount: 0, numericCount: 0, sum: 0, avg: 0, min: 0, max: 0 }
  }
  const { minRow, maxRow, minCol, maxCol } = normalizeRange(range)
  let cellCount = 0
  let numericCount = 0
  let sum = 0
  let min = Infinity
  let max = -Infinity

  for (let r = minRow; r <= maxRow && r < rows.length; r++) {
    const row = rows[r]
    if (!row) continue
    for (let c = minCol; c <= maxCol; c++) {
      const val = (row[c] ?? '').trim()
      if (!val || val === '—') continue
      cellCount += 1
      const num = parseSortableNumber(val)
      if (num !== null) {
        numericCount += 1
        sum += num
        if (num < min) min = num
        if (num > max) max = num
      }
    }
  }

  return {
    cellCount,
    numericCount,
    sum,
    avg: numericCount > 0 ? sum / numericCount : 0,
    min: numericCount > 0 ? min : 0,
    max: numericCount > 0 ? max : 0,
  }
}

/** Profiles a column for the Excel Column Statistics sidebar. */
export function profileColumnValues(
  columnName: string,
  rows: string[][],
  colIndex: number,
): ColumnProfileStats {
  let nonNullCount = 0
  let nullCount = 0
  let numericCount = 0
  let sum = 0
  let minNum = Infinity
  let maxNum = -Infinity
  let minStr: string | null = null
  let maxStr: string | null = null
  const freq = new Map<string, number>()

  for (const row of rows) {
    const raw = (row[colIndex] ?? '').trim()
    if (!raw || raw === '—' || raw.toLowerCase() === 'null') {
      nullCount += 1
      continue
    }
    nonNullCount += 1
    freq.set(raw, (freq.get(raw) ?? 0) + 1)

    const num = parseSortableNumber(raw)
    if (num !== null) {
      numericCount += 1
      sum += num
      if (num < minNum) minNum = num
      if (num > maxNum) maxNum = num
    }
    if (minStr === null || raw.localeCompare(minStr) < 0) minStr = raw
    if (maxStr === null || raw.localeCompare(maxStr) > 0) maxStr = raw
  }

  const isMostlyNumeric = nonNullCount > 0 && numericCount / nonNullCount >= 0.7
  const topValues = Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([value, count]) => ({ value, count }))

  return {
    columnName,
    totalCount: rows.length,
    nonNullCount,
    nullCount,
    distinctCount: freq.size,
    numericCount,
    min: isMostlyNumeric && numericCount > 0 ? String(minNum) : minStr,
    max: isMostlyNumeric && numericCount > 0 ? String(maxNum) : maxStr,
    mean: isMostlyNumeric && numericCount > 0 ? sum / numericCount : null,
    topValues,
  }
}
