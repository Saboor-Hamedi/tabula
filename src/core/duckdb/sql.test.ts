import { describe, expect, it } from 'vitest'
import {
  assertReadOnlySql,
  buildSchemaName,
  normalizeCell,
  normalizeIdentifier,
  qualifiedName,
  quoteIdent,
  quoteString,
  stripFileName,
  toSafeNumber,
  uniqueIdentifier,
} from './sql'

describe('read-only statement guard', () => {
  it('accepts select, with, summarize and describe', () => {
    expect(() => assertReadOnlySql('SELECT 1')).not.toThrow()
    expect(() => assertReadOnlySql('WITH x AS (SELECT 1) SELECT * FROM x')).not.toThrow()
    expect(() => assertReadOnlySql('SUMMARIZE sales')).not.toThrow()
    expect(() => assertReadOnlySql('DESCRIBE sales')).not.toThrow()
  })

  it('blocks writes and multiple statements', () => {
    expect(() => assertReadOnlySql('DELETE FROM sales')).toThrow(/Blocked/)
    expect(() => assertReadOnlySql('SELECT 1; SELECT 2')).toThrow(/one read-only/)
  })

  it('ignores comments and quoted keywords', () => {
    expect(() => assertReadOnlySql("SELECT 'DROP TABLE x' AS text")).not.toThrow()
    expect(() => assertReadOnlySql('-- DROP TABLE sales\nSELECT 1')).not.toThrow()
  })
})

describe('identifier normalization', () => {
  it('creates safe snake_case names', () => {
    expect(normalizeIdentifier('Order Total (USD)', 'data')).toBe('order_total_usd')
    expect(normalizeIdentifier('123 sales', 'data')).toBe('t_123_sales')
  })
})

describe('identifier quoting', () => {
  it('doubles embedded double quotes', () => {
    expect(quoteIdent('weird "name"')).toBe('"weird ""name"""')
  })

  it('quotes strings with doubled single quotes', () => {
    expect(quoteString("it's")).toBe("'it''s'")
  })

  it('qualifies a table with its schema', () => {
    expect(qualifiedName('data', 'orders')).toBe('"data"."orders"')
  })
})

describe('normalizeIdentifier edge cases', () => {
  it('strips diacritics and collapses separators', () => {
    expect(normalizeIdentifier('Café — Revenue (USD)', 'data')).toBe('cafe_revenue_usd')
  })

  it('falls back when the value has nothing usable', () => {
    expect(normalizeIdentifier('!!!', 'data')).toBe('data')
  })

  it('truncates very long identifiers to 64 chars', () => {
    expect(normalizeIdentifier('x'.repeat(200), 'data')).toHaveLength(64)
  })
})

describe('uniqueIdentifier', () => {
  it('deduplicates with a numeric suffix', () => {
    const used = new Set<string>()
    expect(uniqueIdentifier('orders', used)).toBe('orders')
    expect(uniqueIdentifier('orders', used)).toBe('orders_2')
    expect(uniqueIdentifier('orders', used)).toBe('orders_3')
  })

  it('falls back to data for empty bases', () => {
    expect(uniqueIdentifier('', new Set())).toBe('data')
  })
})

describe('stripFileName', () => {
  it('removes directories and the extension', () => {
    expect(stripFileName('C:\\exports\\orders final.csv')).toBe('orders final')
    expect(stripFileName('data/sales.xlsx')).toBe('sales')
    expect(stripFileName('archive.tar.gz')).toBe('archive.tar')
  })
})

describe('buildSchemaName', () => {
  it('compacts the session id into a safe schema name', () => {
    expect(buildSchemaName('abc-DEF_123!')).toMatch(/^sess_abcdef123$/)
  })

  it('falls back to data for an all-symbol id', () => {
    expect(buildSchemaName('!!!')).toBe('sess_data')
  })
})

describe('toSafeNumber', () => {
  it('coerces numbers, bigints and strings', () => {
    expect(toSafeNumber(4)).toBe(4)
    expect(toSafeNumber(9n)).toBe(9)
    expect(toSafeNumber('2.5')).toBe(2.5)
  })

  it('returns 0 for anything else', () => {
    expect(toSafeNumber('nope')).toBe(0)
    expect(toSafeNumber(null)).toBe(0)
    expect(toSafeNumber(Number.NaN)).toBe(0)
  })
})

describe('normalizeCell', () => {
  it('passes through null, boolean and string values', () => {
    expect(normalizeCell(null)).toBeNull()
    expect(normalizeCell(true)).toBe(true)
    expect(normalizeCell('text')).toBe('text')
  })

  it('converts bigints beyond the safe range to strings', () => {
    const big = BigInt('9007199254740993')
    expect(normalizeCell(big)).toBe('9007199254740993')
    expect(normalizeCell(10n)).toBe(10)
  })

  it('drops non-finite numbers to their string form', () => {
    expect(normalizeCell(Number.POSITIVE_INFINITY)).toBe('Infinity')
  })

  it('serializes dates and objects', () => {
    expect(normalizeCell(new Date('2026-11-10T00:00:00.000Z'))).toBe('2026-11-10T00:00:00.000Z')
    expect(normalizeCell({ a: 1 })).toBe('{"a":1}')
  })

  it('marks binary payloads by size', () => {
    expect(normalizeCell(new Uint8Array(4))).toBe('[binary 4 bytes]')
  })
})

describe('assertReadOnlySql hardening', () => {
  it('rejects an empty statement', () => {
    expect(() => assertReadOnlySql('   ')).toThrow(/empty/)
  })

  it('accepts EXPLAIN and SHOW', () => {
    expect(() => assertReadOnlySql('EXPLAIN SELECT 1')).not.toThrow()
    expect(() => assertReadOnlySql('SHOW TABLES')).not.toThrow()
  })

  it('ignores block comments containing SQL keywords', () => {
    expect(() => assertReadOnlySql('SELECT 1 /* DROP TABLE sales; */')).not.toThrow()
  })

  it('blocks mixed-case writes', () => {
    expect(() => assertReadOnlySql('InSeRt INTO t VALUES (1)')).toThrow(/Blocked/)
  })
})
