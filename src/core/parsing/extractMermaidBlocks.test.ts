import { describe, expect, it } from 'vitest'
import { extractMermaidBlocks } from './extractMermaidBlocks'

describe('extractMermaidBlocks', () => {
  it('splits prose and mermaid blocks in order', () => {
    const blocks = extractMermaidBlocks('Before\n```mermaid\ngraph TD;\nA-->B;\n```\nAfter')
    expect(blocks).toEqual([
      { type: 'markdown', content: 'Before' },
      { type: 'mermaid', code: 'graph TD;\nA-->B;' },
      { type: 'markdown', content: 'After' },
    ])
  })

  it('accepts tilde fences and mixed case language tags', () => {
    const blocks = extractMermaidBlocks('~~~Mermaid\nxychart-beta\n~~~')
    expect(blocks).toEqual([{ type: 'mermaid', code: 'xychart-beta' }])
  })

  it('closes a fence with an equal or longer run of the same character', () => {
    const blocks = extractMermaidBlocks('````mermaid\ncontent\n`````\ntail')
    expect(blocks).toEqual([
      { type: 'mermaid', code: 'content' },
      { type: 'markdown', content: 'tail' },
    ])
  })

  it('does not close on a shorter fence or the other fence character', () => {
    const blocks = extractMermaidBlocks('```mermaid\ncontent\n```\nextra')
    expect(blocks[0]).toEqual({ type: 'mermaid', code: 'content' })

    const unterminated = extractMermaidBlocks('```mermaid\nfirst\n~~~\nsecond')
    expect(unterminated).toHaveLength(1)
    expect(unterminated[0].type).toBe('markdown')
  })

  it('recovers an unterminated fence by wrapping it in a closed block', () => {
    const blocks = extractMermaidBlocks('Intro\n```mermaid\ngraph TD;\nA-->B;')
    expect(blocks).toHaveLength(2)
    expect(blocks[0]).toEqual({ type: 'markdown', content: 'Intro' })
    expect(blocks[1].type).toBe('markdown')
    if (blocks[1].type !== 'markdown') return
    expect(blocks[1].content).toContain('```mermaid')
    expect(blocks[1].content).toContain('A-->B;')
    expect(blocks[1].content.trim().endsWith('```')).toBe(true)
  })

  it('skips empty markdown runs between adjacent mermaid blocks', () => {
    const blocks = extractMermaidBlocks('```mermaid\none\n```\n```mermaid\ntwo\n```')
    expect(blocks).toEqual([
      { type: 'mermaid', code: 'one' },
      { type: 'mermaid', code: 'two' },
    ])
  })

  it('does not treat mermaid inside a plain code fence as a diagram', () => {
    const input = '```\nmermaid\nnot a diagram\n```'
    const blocks = extractMermaidBlocks(input)
    expect(blocks.every((block) => block.type === 'markdown')).toBe(true)
  })
})
