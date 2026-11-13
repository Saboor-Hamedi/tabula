import { describe, expect, it } from 'vitest'
import { hasOpenFence, parseMessageContent } from './parseMessage'

describe('parseMessageContent', () => {
  it('splits markdown, mermaid, chart and table blocks', () => {
    const message = [
      'Intro paragraph',
      '',
      '```mermaid',
      'graph TD;',
      'A-->B;',
      '```',
      '',
      '| a | b |',
      '| --- | --- |',
      '| 1 | 2 |',
    ].join('\n')
    const blocks = parseMessageContent(message)
    expect(blocks.map((block) => block.type)).toEqual(['markdown', 'mermaid', 'table'])
  })

  it('drops empty mermaid fences entirely', () => {
    const blocks = parseMessageContent('```mermaid\n\n```')
    expect(blocks.every((block) => block.type !== 'mermaid')).toBe(true)
  })

  it('memoizes results by content string', () => {
    const blocks = parseMessageContent('cache me')
    expect(parseMessageContent('cache me')).toBe(blocks)
  })

  it('keeps chart blocks in order with surrounding prose', () => {
    const chart = JSON.stringify({
      type: 'series',
      kind: 'bar',
      xLabel: 'Region',
      yLabel: 'Revenue',
      points: [
        { label: 'EMEA', value: 10 },
        { label: 'APAC', value: 20 },
      ],
    })
    const blocks = parseMessageContent(`before\n\`\`\`chart\n${chart}\n\`\`\`\nafter`)
    expect(blocks.map((block) => block.type)).toEqual(['markdown', 'chart', 'markdown'])
  })

  it('ignores whitespace-only markdown between blocks', () => {
    const blocks = parseMessageContent('```mermaid\ngraph TD;\nA-->B;\n```\n\n\n```mermaid\none\n```')
    expect(blocks.map((block) => block.type)).toEqual(['mermaid', 'mermaid'])
  })
})

describe('hasOpenFence', () => {
  it('detects an unterminated fence', () => {
    expect(hasOpenFence('```chart\n{}')).toBe(true)
  })

  it('detects a balanced fence as closed', () => {
    expect(hasOpenFence('```chart\n{}\n```')).toBe(false)
  })

  it('handles tilde fences and indented fences', () => {
    expect(hasOpenFence('~~~')).toBe(true)
    expect(hasOpenFence('  ```\ncode\n  ```')).toBe(false)
  })

  it('returns false when there is no fence at all', () => {
    expect(hasOpenFence('plain text')).toBe(false)
  })
})
