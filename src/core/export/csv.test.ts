import { describe, expect, it } from 'vitest'
import { buildCsv } from './csv'

describe('buildCsv', () => {
  it('joins headers and rows with commas', () => {
    const csv = buildCsv(['Name', 'Orders'], [['Ada', '12'], ['Grace', '7']])
    expect(csv).toBe('Name,Orders\nAda,12\nGrace,7')
  })

  it('quotes cells that contain commas, quotes or newlines', () => {
    const csv = buildCsv(['Note'], [['a,b'], ['say "hi"'], ['line1\nline2']])
    expect(csv).toBe('Note\n"a,b"\n"say ""hi"""\nline1 line2')
  })

  it('escapes embedded quotes by doubling them', () => {
    expect(buildCsv(['q'], [['he said "yes, loudly"']])).toBe('q\n"he said ""yes, loudly"""')
  })

  it('strips inline markdown before exporting', () => {
    expect(buildCsv(['N'], [['**42** *total* `gross`']])).toBe('N\n42 total gross')
  })

  it('fills missing cells with empty strings and ignores extras', () => {
    const csv = buildCsv(['A', 'B', 'C'], [['only-a']])
    expect(csv).toBe('A,B,C\nonly-a,,')
  })

  it('collapses CRLF and trims cell values', () => {
    expect(buildCsv(['A'], [['  padded  ']])).toBe('A\npadded')
    expect(buildCsv(['A'], [['one\r\ntwo']])).toBe('A\none two')
  })
})
