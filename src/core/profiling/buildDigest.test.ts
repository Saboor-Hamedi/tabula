import { describe, expect, it } from 'vitest'
import {
  isCategoricalColumn,
  isNumericColumn,
  isTemporalColumn,
} from './buildDigest'
import type { DigestColumn } from '../types'

function column(partial: Partial<DigestColumn> & { name: string }): DigestColumn {
  return { type: 'VARCHAR', distinctCount: 5, topValues: [], ...partial }
}

describe('isNumericColumn', () => {
  it('accepts plain numeric measures', () => {
    expect(isNumericColumn(column({ name: 'order_total_usd', type: 'DECIMAL' }))).toBe(true)
    expect(isNumericColumn(column({ name: 'qty', type: 'BIGINT' }))).toBe(true)
    expect(isNumericColumn(column({ name: 'ratio', type: 'DOUBLE' }))).toBe(true)
  })

  it('rejects non-numeric types', () => {
    expect(isNumericColumn(column({ name: 'region', type: 'VARCHAR' }))).toBe(false)
    expect(isNumericColumn(column({ name: 'created', type: 'TIMESTAMP' }))).toBe(false)
  })

  it('rejects identifier-like names even when numeric', () => {
    expect(isNumericColumn(column({ name: 'id', type: 'BIGINT' }))).toBe(false)
    expect(isNumericColumn(column({ name: 'order_id', type: 'BIGINT' }))).toBe(false)
  })

  it('rejects obvious codes and years', () => {
    expect(isNumericColumn(column({ name: 'zip_code', type: 'INTEGER' }))).toBe(false)
    expect(isNumericColumn(column({ name: 'order_year', type: 'INTEGER' }))).toBe(false)
    expect(isNumericColumn(column({ name: 'postal_code', type: 'INTEGER' }))).toBe(false)
  })
})

describe('isCategoricalColumn', () => {
  it('accepts booleans regardless of cardinality', () => {
    expect(isCategoricalColumn(column({ name: 'is_active', type: 'BOOLEAN', distinctCount: 2 }))).toBe(true)
  })

  it('accepts low-cardinality groupable columns', () => {
    expect(isCategoricalColumn(column({ name: 'region', type: 'VARCHAR', distinctCount: 4 }))).toBe(true)
  })

  it('rejects high-cardinality columns', () => {
    expect(isCategoricalColumn(column({ name: 'free_text', type: 'VARCHAR', distinctCount: 500 }))).toBe(false)
  })

  it('rejects constant single-value columns', () => {
    expect(isCategoricalColumn(column({ name: 'constant', type: 'VARCHAR', distinctCount: 1 }))).toBe(false)
  })

  it('rejects id-like columns', () => {
    expect(isCategoricalColumn(column({ name: 'order_id', type: 'VARCHAR', distinctCount: 30 }))).toBe(false)
    expect(isCategoricalColumn(column({ name: 'id', type: 'INTEGER', distinctCount: 30 }))).toBe(false)
  })

  it('rejects ungroupable types', () => {
    expect(isCategoricalColumn(column({ name: 'blob_col', type: 'BLOB', distinctCount: 3 }))).toBe(false)
  })
})

describe('isTemporalColumn', () => {
  it('accepts date and time types', () => {
    expect(isTemporalColumn(column({ name: 'd', type: 'DATE' }))).toBe(true)
    expect(isTemporalColumn(column({ name: 't', type: 'TIMESTAMP WITH TIME ZONE' }))).toBe(true)
  })

  it('rejects non-temporal types', () => {
    expect(isTemporalColumn(column({ name: 'n', type: 'INTEGER' }))).toBe(false)
  })
})
