import { describe, expect, it } from 'vitest'
import {
  compareCells,
  computeSelectionSummary,
  formatCellRef,
  formatRangeLabel,
  normalizeRange,
  parseCsvToGrid,
  profileColumnValues,
  toExcelColumnLetter,
} from './utils'

describe('toExcelColumnLetter', () => {
  it('maps 0-based indexes to Excel column letters', () => {
    expect(toExcelColumnLetter(0)).toBe('A')
    expect(toExcelColumnLetter(25)).toBe('Z')
    expect(toExcelColumnLetter(26)).toBe('AA')
    expect(toExcelColumnLetter(27)).toBe('AB')
    expect(toExcelColumnLetter(51)).toBe('AZ')
    expect(toExcelColumnLetter(52)).toBe('BA')
    expect(toExcelColumnLetter(701)).toBe('ZZ')
    expect(toExcelColumnLetter(702)).toBe('AAA')
  })
})

describe('formatCellRef', () => {
  it('combines the column letter and 1-based row number', () => {
    expect(formatCellRef(0, 0)).toBe('A1')
    expect(formatCellRef(9, 2)).toBe('C10')
  })
})

describe('normalizeRange', () => {
  it('orders corners regardless of drag direction', () => {
    expect(
      normalizeRange({ start: { row: 5, col: 3 }, end: { row: 1, col: 0 } }),
    ).toEqual({ minRow: 1, maxRow: 5, minCol: 0, maxCol: 3 })
  })
})

describe('formatRangeLabel', () => {
  it('returns A1 for null', () => {
    expect(formatRangeLabel(null)).toBe('A1')
  })

  it('returns a single cell for collapsed selections', () => {
    expect(formatRangeLabel({ start: { row: 0, col: 0 }, end: { row: 0, col: 0 } })).toBe('A1')
  })

  it('returns a ref pair for multi-cell selections', () => {
    expect(formatRangeLabel({ start: { row: 0, col: 0 }, end: { row: 3, col: 2 } })).toBe('A1:C4')
  })
})

describe('parseCsvToGrid', () => {
  it('parses headers and rows', () => {
    const { headers, rows } = parseCsvToGrid('name,orders\nAda,12\nGrace,7')
    expect(headers).toEqual(['name', 'orders'])
    expect(rows).toEqual([
      ['Ada', '12'],
      ['Grace', '7'],
    ])
  })

  it('keeps quoted commas and newlines inside cells', () => {
    const { rows } = parseCsvToGrid('name,note\nAda,"a, b"\nGrace,"line1\nline2"')
    expect(rows[0][1]).toBe('a, b')
    expect(rows[1][1]).toBe('line1\nline2')
  })

  it('returns empty output for blank input', () => {
    expect(parseCsvToGrid('')).toEqual({ headers: [], rows: [] })
    expect(parseCsvToGrid('   ')).toEqual({ headers: [], rows: [] })
  })

  it('fills empty header cells with positional labels', () => {
    const { headers } = parseCsvToGrid(',orders\nAda,12')
    expect(headers).toEqual(['Column 1', 'orders'])
  })
})

describe('compareCells', () => {
  it('sorts empty cells last in both directions', () => {
    expect(compareCells('', 'a', 'asc')).toBe(1)
    expect(compareCells('a', '', 'asc')).toBe(-1)
    expect(compareCells('', 'a', 'desc')).toBe(1)
    expect(compareCells('—', 'a', 'asc')).toBe(1)
    expect(compareCells('null', 'a', 'asc')).toBe(1)
  })

  it('compares numeric cells numerically', () => {
    expect(compareCells('10', '2', 'asc')).toBeGreaterThan(0)
    expect(compareCells('$1,000', '$900', 'asc')).toBeGreaterThan(0)
    expect(compareCells('45%', '50%', 'asc')).toBeLessThan(0)
  })

  it('reverses the order in desc direction', () => {
    expect(compareCells('10', '2', 'desc')).toBeLessThan(0)
  })

  it('falls back to locale compare for text', () => {
    expect(Math.sign(compareCells('apple', 'banana', 'asc'))).toBe(-1)
  })
})

describe('computeSelectionSummary', () => {
  const rows = [
    ['a', '10', 'x'],
    ['b', '20', ''],
    ['c', '', '40'],
  ]

  it('returns zeros for a null range', () => {
    expect(computeSelectionSummary(rows, null)).toEqual({
      cellCount: 0,
      numericCount: 0,
      sum: 0,
      avg: 0,
      min: 0,
      max: 0,
    })
  })

  it('sums numeric cells inside the range only', () => {
    const summary = computeSelectionSummary(rows, {
      start: { row: 0, col: 1 },
      end: { row: 2, col: 1 },
    })
    expect(summary.numericCount).toBe(2)
    expect(summary.sum).toBe(30)
    expect(summary.avg).toBe(15)
    expect(summary.min).toBe(10)
    expect(summary.max).toBe(20)
    expect(summary.cellCount).toBe(2)
  })

  it('counts text cells toward cellCount but not numericCount', () => {
    const summary = computeSelectionSummary(rows, {
      start: { row: 0, col: 0 },
      end: { row: 0, col: 2 },
    })
    expect(summary.cellCount).toBe(3)
    expect(summary.numericCount).toBe(1)
  })

  it('clamps ranges that extend past the row array', () => {
    const summary = computeSelectionSummary(rows, {
      start: { row: 0, col: 0 },
      end: { row: 99, col: 9 },
    })
    expect(summary.cellCount).toBe(7)
  })
})

describe('profileColumnValues', () => {
  const rows = [
    ['EMEA', '10'],
    ['APAC', '20'],
    ['EMEA', '30'],
    ['', '40'],
  ]

  it('counts nulls and non-nulls', () => {
    const stats = profileColumnValues('region', rows, 0)
    expect(stats.totalCount).toBe(4)
    expect(stats.nonNullCount).toBe(3)
    expect(stats.nullCount).toBe(1)
    expect(stats.distinctCount).toBe(2)
  })

  it('computes numeric stats for mostly-numeric columns', () => {
    const stats = profileColumnValues('amount', rows, 1)
    expect(stats.numericCount).toBe(4)
    expect(stats.min).toBe('10')
    expect(stats.max).toBe('40')
    expect(stats.mean).toBe(25)
  })

  it('returns string min/max for text columns', () => {
    const stats = profileColumnValues('region', rows, 0)
    expect(stats.min).toBe('APAC')
    expect(stats.max).toBe('EMEA')
    expect(stats.mean).toBeNull()
  })

  it('surfaces the most frequent values, capped', () => {
    const stats = profileColumnValues('region', rows, 0)
    expect(stats.topValues[0]).toEqual({ value: 'EMEA', count: 2 })
    expect(stats.topValues.length).toBeLessThanOrEqual(8)
  })
})
