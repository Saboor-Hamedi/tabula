import { describe, expect, it } from 'vitest'
import { extractTableBlocks } from './extractTableBlocks'

const TABLE = [
  '| Region | Revenue |',
  '| --- | --- |',
  '| EMEA | 4.2 |',
  '| APAC | 1.7 |',
].join('\n')

describe('extractTableBlocks', () => {
  it('parses a simple table with headers and rows', () => {
    const blocks = extractTableBlocks(TABLE)
    expect(blocks).toHaveLength(1)
    const table = blocks[0]
    expect(table.type).toBe('table')
    if (table.type !== 'table') return
    expect(table.headers).toEqual(['Region', 'Revenue'])
    expect(table.rows).toEqual([
      ['EMEA', '4.2'],
      ['APAC', '1.7'],
    ])
  })

  it('reads column alignments from the separator row', () => {
    const blocks = extractTableBlocks(
      '| a | b | c |\n| :-- | :-: | --: |\n| 1 | 2 | 3 |',
    )
    const table = blocks[0]
    expect(table.type).toBe('table')
    if (table.type !== 'table') return
    expect(table.alignments).toEqual(['left', 'center', 'right'])
  })

  it('omits alignments when none are colon markers', () => {
    const blocks = extractTableBlocks(TABLE)
    const table = blocks[0]
    if (table.type !== 'table') return
    expect(table.alignments).toBeUndefined()
  })

  it('keeps escaped pipes inside cell values', () => {
    const blocks = extractTableBlocks(
      '| Expr |\n| --- |\n| a \\| b |',
    )
    const table = blocks[0]
    if (table.type !== 'table') return
    expect(table.rows[0]).toEqual(['a | b'])
  })

  it('normalizes short rows to the header width and drops empty cells beyond it', () => {
    const blocks = extractTableBlocks(
      '| a | b | c |\n| --- | --- | --- |\n| 1 | 2 |',
    )
    const table = blocks[0]
    if (table.type !== 'table') return
    expect(table.rows[0]).toEqual(['1', '2', ''])
  })

  it('does not parse tables inside code fences', () => {
    const blocks = extractTableBlocks(`\`\`\`\n${TABLE}\n\`\`\``)
    expect(blocks).toHaveLength(1)
    expect(blocks[0].type).toBe('markdown')
  })

  it('stops a table at a blank line', () => {
    const blocks = extractTableBlocks(`${TABLE}\n\ntail paragraph`)
    expect(blocks.map((block) => block.type)).toEqual(['table', 'markdown'])
  })

  it('ignores a separator-looking line without a preceding header', () => {
    const blocks = extractTableBlocks('--- | ---\nnot a table')
    expect(blocks.every((block) => block.type === 'markdown')).toBe(true)
  })

  it('handles tilde code fences', () => {
    const blocks = extractTableBlocks(`~~~\n${TABLE}\n~~~`)
    expect(blocks).toHaveLength(1)
    expect(blocks[0].type).toBe('markdown')
  })
})
