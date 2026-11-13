import { describe, expect, it } from 'vitest'
import type { DigestColumn, ModelId } from '../types'
import {
  buildLocalSuggestions,
  generateSuggestions,
} from './suggestions'

function makeSession(tables: Array<{ name: string; rowCount?: number; columnCount?: number }>, primaryTable?: string | null) {
  return {
    id: 's1',
    fileName: 'orders.csv',
    fileType: 'csv' as const,
    fileSize: 1,
    uploadedAt: Date.now(),
    schemaName: 'sess_1',
    tables: tables.map((t) => ({
      name: t.name,
      rowCount: t.rowCount ?? 100,
      columnCount: t.columnCount ?? 5,
    })),
    primaryTable: primaryTable === undefined ? tables[0]?.name ?? null : primaryTable,
  }
}

function column(partial: Partial<DigestColumn> & { name: string }): DigestColumn {
  return {
    type: 'VARCHAR',
    distinctCount: 5,
    topValues: [],
    ...partial,
  }
}

const digest = {
  tables: [
    {
      name: 'orders',
      rowCount: 420,
      columns: [
        column({ name: 'order_date', type: 'DATE', distinctCount: 90 }),
        column({ name: 'order_total_usd', type: 'DECIMAL', distinctCount: 380 }),
        column({ name: 'region', type: 'VARCHAR', distinctCount: 4, topValues: ['EMEA', 'APAC'] }),
      ],
    },
  ],
}

describe('buildLocalSuggestions', () => {
  it('grounds questions in real table and column names', () => {
    const suggestions = buildLocalSuggestions(makeSession([{ name: 'orders' }]), digest)
    expect(suggestions.length).toBeGreaterThan(0)
    expect(suggestions.length).toBeLessThanOrEqual(4)
    expect(suggestions.some((s) => s.includes('orders') || s.includes('order total usd'))).toBe(true)
  })

  it('asks about a trend when a temporal column and a measure exist', () => {
    const suggestions = buildLocalSuggestions(makeSession([{ name: 'orders' }]), digest)
    expect(suggestions.some((s) => /over order date/.test(s))).toBe(true)
  })

  it('references a top category value when available', () => {
    const suggestions = buildLocalSuggestions(makeSession([{ name: 'orders' }]), digest)
    expect(suggestions.some((s) => s.includes('"EMEA"'))).toBe(true)
  })

  it('never emits duplicate questions', () => {
    const suggestions = buildLocalSuggestions(makeSession([{ name: 'orders' }]), digest)
    const keys = suggestions.map((s) => s.toLowerCase())
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('still produces generic questions with an empty digest', () => {
    const suggestions = buildLocalSuggestions(makeSession([{ name: 'orders' }]), null)
    expect(suggestions.length).toBeGreaterThan(0)
    expect(suggestions.every((s) => typeof s === 'string' && s.length > 0)).toBe(true)
  })

  it('survives a corrupt digest payload', () => {
    const suggestions = buildLocalSuggestions(
      makeSession([{ name: 'orders' }]),
      { tables: [{ name: 1, columns: 'nope' }] } as never,
    )
    expect(suggestions.length).toBeGreaterThan(0)
  })

  it('prefers the primary table when it exists', () => {
    const multi = {
      tables: [
        digest.tables[0],
        {
          name: 'returns',
          rowCount: 50,
          columns: [column({ name: 'refund_total_usd', type: 'DECIMAL', distinctCount: 40 })],
        },
      ],
    }
    const suggestions = buildLocalSuggestions(
      makeSession([{ name: 'orders' }, { name: 'returns' }], 'returns'),
      multi,
    )
    expect(suggestions.some((s) => s.includes('refund total usd') || s.includes('returns'))).toBe(true)
  })
})

describe('generateSuggestions', () => {
  it('returns the local deterministic suggestions without a model call', async () => {
    const session = makeSession([{ name: 'orders' }])
    const model: ModelId = 'deepseek-v4-flash'
    const [local, generated] = await Promise.all([
      Promise.resolve(buildLocalSuggestions(session, digest)),
      generateSuggestions({ session, digest, model }),
    ])
    expect(generated).toEqual(local)
  })
})
