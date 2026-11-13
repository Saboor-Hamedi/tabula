import { describe, expect, it } from 'vitest'
import { figureName, getNextRenderId } from './mermaidUtils'

describe('figureName', () => {
  it('derives a file-safe slug from the diagram title', () => {
    expect(figureName('xychart-beta\n  title "Q3 Revenue"\n  bar [1]')).toBe('tabula-q3-revenue')
  })

  it('handles quoted and unquoted titles', () => {
    expect(figureName('pie title Revenue Split\n"A": 1')).toBe('tabula-revenue-split')
  })

  it('falls back to chart when there is no title', () => {
    expect(figureName('graph TD;\nA-->B')).toBe('tabula-chart')
  })

  it('collapses punctuation runs and trims dashes', () => {
    expect(figureName('title "  --Weird   Title!! "')).toBe('tabula-weird-title')
  })

  it('caps the slug at 48 characters', () => {
    const long = `title "${'word '.repeat(30)}"`
    const name = figureName(long)
    expect(name.length).toBeLessThanOrEqual('tabula-'.length + 48)
  })
})

describe('getNextRenderId', () => {
  it('produces unique, prefixed ids', () => {
    const first = getNextRenderId()
    const second = getNextRenderId()
    expect(first).toMatch(/^tabula-mermaid-\d+$/)
    expect(second).toMatch(/^tabula-mermaid-\d+$/)
    expect(first).not.toBe(second)
  })
})
