import { memo, useMemo } from 'react'
import type { FigureChanges } from '../../core/parsing/editFigure'
import { parseMessageContent } from '../../core/parsing/parseMessage'
import type { ContentBlock } from '../../core/types'
import { ChartBlock } from '../render/ChartBlock'
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
  onEditFigure?: (figureIndex: number, changes: FigureChanges) => void
}

function renderBlock(
  block: ContentBlock,
  index: number,
  streaming: boolean,
  figureIndex: number | null,
  onEditFigure?: (figureIndex: number, changes: FigureChanges) => void,
) {
  if (block.type === 'mermaid') {
    return (
      <MermaidBlock
        key={`mermaid-${index}`}
        code={block.code}
        streaming={streaming}
        onEdit={
          onEditFigure && figureIndex !== null
            ? (changes) => onEditFigure(figureIndex, changes)
            : undefined
        }
      />
    )
  }
  if (block.type === 'chart') {
    return (
      <ChartBlock
        key={`chart-${index}`}
        chart={block.chart}
        onEdit={
          onEditFigure && figureIndex !== null
            ? (changes) => onEditFigure(figureIndex, changes)
            : undefined
        }
      />
    )
  }
  if (block.type === 'table') {
    return <DataTable key={`table-${index}`} headers={block.headers} rows={block.rows} />
  }
  return <MarkdownText key={`markdown-${index}`} content={block.content} />
}

export const MessageRenderer = memo(function MessageRenderer({
  content,
  streaming = false,
  onEditFigure,
}: MessageRendererProps) {
  const blocks = useMemo(() => parseMessageContent(content), [content])

  let figureIndex = 0
  return (
    <div className="message-content">
      {blocks.map((block, index) => {
        const currentFigure =
          block.type === 'mermaid' || block.type === 'chart' ? figureIndex++ : null
        return renderBlock(block, index, streaming, currentFigure, onEditFigure)
      })}
    </div>
  )
})
