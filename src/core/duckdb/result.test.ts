import { describe, expect, it } from 'vitest'
import {
  firstNumber,
  firstScalar,
  tableColumns,
  tableToRawRows,
  tableToRows,
} from './result'

function fakeRow(values: Record<string, unknown>) {
  return { toJSON: () => ({ ...values }) }
}

function fakeArrowTable(rows: unknown[], fields: string[] = []) {
  return {
    numRows: rows.length,
    schema: { fields: fields.map((name) => ({ name })) },
    toArray: () => rows,
    slice(begin: number, end?: number) {
      return fakeArrowTable(rows.slice(begin, end), fields)
    },
  }
}

describe('tableToRawRows', () => {
  it('maps Arrow rows to plain objects', () => {
    const table = fakeArrowTable([fakeRow({ a: 1 }), fakeRow({ a: 2 })])
    expect(tableToRawRows(table)).toEqual([{ a: 1 }, { a: 2 }])
  })

  it('returns an empty array for missing or malformed tables', () => {
    expect(tableToRawRows(null)).toEqual([])
    expect(tableToRawRows(undefined)).toEqual([])
    expect(tableToRawRows({} as never)).toEqual([])
  })

  it('skips rows without a toJSON method', () => {
    const table = fakeArrowTable([fakeRow({ a: 1 }), { noToJSON: true }])
    expect(tableToRawRows(table)).toEqual([{ a: 1 }])
  })
})

describe('tableToRows', () => {
  it('normalizes bigint values to numbers inside the safe range', () => {
    const table = fakeArrowTable([fakeRow({ big: 42n })])
    expect(tableToRows(table)).toEqual([{ big: 42 }])
  })

  it('keeps Date values as ISO strings', () => {
    const date = new Date('2026-11-10T10:00:00.000Z')
    const table = fakeArrowTable([fakeRow({ at: date })])
    expect(tableToRows(table)[0].at).toBe('2026-11-10T10:00:00.000Z')
  })
})

describe('tableColumns', () => {
  it('reads field names in order', () => {
    const table = fakeArrowTable([], ['a', 'b', 'c'])
    expect(tableColumns(table)).toEqual(['a', 'b', 'c'])
  })

  it('returns an empty array for malformed input', () => {
    expect(tableColumns(null)).toEqual([])
    expect(tableColumns({} as never)).toEqual([])
  })
})

describe('firstScalar and firstNumber', () => {
  it('reads the first value of a column', () => {
    const table = fakeArrowTable([fakeRow({ n: 7 }), fakeRow({ n: 9 })])
    expect(firstScalar(table, 'n')).toBe(7)
    expect(firstNumber(table, 'n')).toBe(7)
  })

  it('coerces bigints and strings to numbers', () => {
    const table = fakeArrowTable([fakeRow({ n: 12n })])
    expect(firstNumber(table, 'n')).toBe(12)

    const strings = fakeArrowTable([fakeRow({ n: '3.5' })])
    expect(firstNumber(strings, 'n')).toBe(3.5)
  })

  it('returns null / zero when the table is empty', () => {
    const table = fakeArrowTable([])
    expect(firstScalar(table, 'n')).toBeNull()
    expect(firstNumber(table, 'n')).toBe(0)
  })
})
