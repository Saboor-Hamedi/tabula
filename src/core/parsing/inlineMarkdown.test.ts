import { describe, expect, it } from 'vitest'
import { parseInlineMarkdown, stripInlineMarkdown } from './inlineMarkdown'

describe('inline table text', () => {
  it('parses emphasis and code', () => {
    expect(parseInlineMarkdown('**42** *orders* `gross`')).toEqual([
      { type: 'strong', value: '42' },
      { type: 'text', value: ' ' },
      { type: 'em', value: 'orders' },
      { type: 'text', value: ' ' },
      { type: 'code', value: 'gross' },
    ])
  })

  it('strips markers for exports', () => {
    expect(stripInlineMarkdown('**42** *orders* `gross`')).toBe('42 orders gross')
  })
})
