import type { ContentBlock } from '../types'
import { extractMermaidBlocks } from './extractMermaidBlocks'
import { extractTableBlocks } from './extractTableBlocks'

export function parseMessageContent(text: string): ContentBlock[] {
  const blocks: ContentBlock[] = []

  for (const block of extractMermaidBlocks(text)) {
    if (block.type === 'mermaid') {
      if (block.code.trim().length > 0) {
        blocks.push({ type: 'mermaid', code: block.code })
      }
      continue
    }
    if (block.type !== 'markdown') continue

    for (const inner of extractTableBlocks(block.content)) {
      if (inner.type === 'table') {
        blocks.push({ type: 'table', headers: inner.headers, rows: inner.rows })
      } else if (inner.type === 'markdown' && inner.content.trim().length > 0) {
        blocks.push({ type: 'markdown', content: inner.content.trim() })
      }
    }
  }

  return blocks
}
