import { memo, useMemo } from 'react'
import { parseMessageContent } from '../../core/parsing/parseMessage'
import type { ContentBlock } from '../../core/types'
import { DataTable } from '../render/DataTable'
import { MarkdownText } from '../render/MarkdownText'
import { MermaidBlock } from '../render/MermaidBlock'

/**
 * Renders one assistant message.
 *
 * Parsing is memoized on the content string, and each block is a memoized
 * component, so a streaming token only re-renders the block it lands in. That is
 * what keeps long conversations with charts and tables responsive.
 */

export interface MessageRendererProps {
  content: string
  /** While streaming, hold back chart rendering until fences close. */
  streaming?: boolean
}

function renderBlock(block: ContentBlock, index: number, streaming: boolean) {
  if (block.type === 'mermaid') {
    return <MermaidBlock key={`mermaid-${index}`} code={block.code} streaming={streaming} />
  }
  if (block.type === 'table') {
    return <DataTable key={`table-${index}`} headers={block.headers} rows={block.rows} />
  }
  return <MarkdownText key={`markdown-${index}`} content={block.content} />
}

export const MessageRenderer = memo(function MessageRenderer({
  content,
  streaming = false,
}: MessageRendererProps) {
  const blocks = useMemo(() => parseMessageContent(content), [content])

  return (
    <div className="message-content">
      {blocks.map((block, index) => renderBlock(block, index, streaming))}
    </div>
  )
})
