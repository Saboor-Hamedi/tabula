import type { ContentBlock } from '../types'
import { extractChartBlocks } from './extractChartBlocks'
import { extractMermaidBlocks } from './extractMermaidBlocks'
import { extractTableBlocks } from './extractTableBlocks'

/**
 * Splits an assistant message into renderable blocks: markdown, mermaid, tables.
 *
 * Parsing runs on every streamed token, so results are memoized by content
 * string. The cache is bounded because a long conversation would otherwise hold
 * every intermediate streaming state forever.
 */

const CACHE_LIMIT = 120
const cache = new Map<string, ContentBlock[]>()

function parse(text: string): ContentBlock[] {
  const blocks: ContentBlock[] = []

  for (const block of extractMermaidBlocks(text)) {
    if (block.type === 'mermaid') {
      if (block.code.trim().length > 0) {
        blocks.push({ type: 'mermaid', code: block.code })
      }
      continue
    }
    if (block.type !== 'markdown') continue

    for (const chartBlock of extractChartBlocks(block.content)) {
      if (chartBlock.type === 'chart') {
        blocks.push(chartBlock)
        continue
      }
      if (chartBlock.type !== 'markdown') continue

      for (const inner of extractTableBlocks(chartBlock.content)) {
        if (inner.type === 'table') {
          blocks.push({ type: 'table', headers: inner.headers, rows: inner.rows })
        } else if (inner.type === 'markdown' && inner.content.trim().length > 0) {
          blocks.push({ type: 'markdown', content: inner.content.trim() })
        }
      }
    }
  }

  return blocks
}

export function parseMessageContent(text: string): ContentBlock[] {
  const cached = cache.get(text)
  if (cached) return cached

  const blocks = parse(text)

  if (cache.size >= CACHE_LIMIT) {
    // Drop the oldest entry. Map preserves insertion order.
    const oldest = cache.keys().next().value
    if (oldest !== undefined) cache.delete(oldest)
  }
  cache.set(text, blocks)

  return blocks
}

/**
 * True when the text contains an unterminated code fence.
 *
 * While a message is streaming, a partially-written mermaid block would render
 * as broken syntax and then remount when the fence closes. Callers use this to
 * hold back expensive rendering until the block is complete.
 */
export function hasOpenFence(text: string): boolean {
  const fences = text.match(/^\s*(```|~~~)/gm)
  return fences !== null && fences.length % 2 === 1
}
