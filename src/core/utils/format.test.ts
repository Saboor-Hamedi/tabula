import { describe, expect, it } from 'vitest'
import {
  formatBytes,
  formatCompact,
  formatCount,
  formatDuration,
  formatRelativeTime,
  formatTime,
  safeStringify,
  truncateMiddle,
} from './format'

describe('formatCount', () => {
  it('formats integers with thousands separators', () => {
    expect(formatCount(1234567)).toBe('1,234,567')
    expect(formatCount(0)).toBe('0')
  })

  it('returns 0 for non-finite values', () => {
    expect(formatCount(Number.NaN)).toBe('0')
    expect(formatCount(Number.POSITIVE_INFINITY)).toBe('0')
  })
})

describe('formatCompact', () => {
  it('uses compact notation with at most one fraction digit', () => {
    expect(formatCompact(1200)).toBe('1.2K')
    expect(formatCompact(3_400_000)).toBe('3.4M')
    expect(formatCompact(950)).toBe('950')
  })

  it('returns 0 for non-finite values', () => {
    expect(formatCompact(Number.NaN)).toBe('0')
  })
})

describe('formatBytes', () => {
  it('returns 0 B for zero, negative or non-finite input', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(-10)).toBe('0 B')
    expect(formatBytes(Number.NaN)).toBe('0 B')
  })

  it('scales through B, KB, MB and GB', () => {
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(2048)).toBe('2.0 KB')
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB')
    expect(formatBytes(1.5 * 1024 * 1024 * 1024)).toBe('1.5 GB')
  })

  it('uses a decimal only when the value is below 10 in a non-byte unit', () => {
    expect(formatBytes(1536)).toBe('1.5 KB')
    expect(formatBytes(10 * 1024)).toBe('10 KB')
  })

  it('caps at the largest unit for huge values', () => {
    expect(formatBytes(8 * 1024 ** 4)).toBe('8192 GB')
  })
})

describe('formatDuration', () => {
  it('returns 0 ms for negative or non-finite input', () => {
    expect(formatDuration(-1)).toBe('0 ms')
    expect(formatDuration(Number.POSITIVE_INFINITY)).toBe('0 ms')
  })

  it('renders sub-second durations in whole milliseconds', () => {
    expect(formatDuration(0)).toBe('0 ms')
    expect(formatDuration(123.6)).toBe('124 ms')
  })

  it('renders seconds with one decimal below 10 s and none above', () => {
    expect(formatDuration(1500)).toBe('1.5 s')
    expect(formatDuration(9999)).toBe('10.0 s')
    expect(formatDuration(12_000)).toBe('12 s')
  })
})

describe('formatTime', () => {
  it('renders a local time string for the timestamp', () => {
    const result = formatTime(new Date('2026-11-10T15:30:00').getTime())
    expect(result).toMatch(/\d{1,2}:\d{2}/)
  })
})

describe('formatRelativeTime', () => {
  it('handles the just-now boundary', () => {
    expect(formatRelativeTime(Date.now())).toBe('just now')
  })

  it('reports minutes, hours and days', () => {
    const minute = 60_000
    const hour = 60 * minute
    const day = 24 * hour
    expect(formatRelativeTime(Date.now() - 5 * minute)).toBe('5m ago')
    expect(formatRelativeTime(Date.now() - 3 * hour)).toBe('3h ago')
    expect(formatRelativeTime(Date.now() - 2 * day)).toBe('2d ago')
  })

  it('falls back to a locale date beyond a week', () => {
    const old = Date.now() - 30 * 24 * 60 * 60 * 1000
    expect(formatRelativeTime(old)).toBe(new Date(old).toLocaleDateString())
  })
})

describe('truncateMiddle', () => {
  it('leaves short values untouched', () => {
    expect(truncateMiddle('short', 10)).toBe('short')
  })

  it('keeps both ends of a long value with a single ellipsis', () => {
    const result = truncateMiddle('a'.repeat(100), 21)
    expect(result).toBe(`${'a'.repeat(10)}…${'a'.repeat(10)}`)
    expect(result.length).toBe(21)
  })
})

describe('safeStringify', () => {
  it('serializes plain values', () => {
    expect(safeStringify({ a: 1 })).toBe('{\n  "a": 1\n}')
  })

  it('stringifies bigints and dates', () => {
    expect(safeStringify({ n: 10n }, 0)).toBe('{"n":"10"}')
    expect(safeStringify({ at: new Date('2026-11-10T00:00:00.000Z') }, 0)).toBe(
      '{"at":"2026-11-10T00:00:00.000Z"}',
    )
  })

  it('marks circular references instead of throwing', () => {
    const value: Record<string, unknown> = {}
    value.self = value
    expect(safeStringify(value)).toContain('[circular]')
  })

  it('falls back to String() for unserializable input', () => {
    const exploding = {
      toJSON(): never {
        throw new Error('nope')
      },
    }
    expect(safeStringify(exploding)).toBe('[object Object]')
  })
})
