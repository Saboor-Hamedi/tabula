import { describe, expect, it } from 'vitest'
import { assertReadOnlySql, normalizeIdentifier } from './sql'

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
