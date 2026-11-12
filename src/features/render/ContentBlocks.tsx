import { memo } from 'react'
import type { FigureChanges } from '../../core/parsing/editFigure'
import type { ContentBlock } from '../../core/types'
import { ChartBlock } from './ChartBlock'
import { DataTable } from './DataTable'
import { MarkdownText } from './MarkdownText'
import { MermaidBlock } from '../mermaid/MermaidBlock'

/**
 * Renders a list of parsed content blocks.
 *
 * Both the chat transcript and the published posts page draw the same blocks
 * (markdown, mermaid, charts, tables) through this component, so a published
 * answer looks exactly like the answer the admin produced.
 */

export interface ContentBlocksProps {
  blocks: ContentBlock[]
  /** While streaming, hold back chart rendering until fences close. */
  streaming?: boolean
  /** Supplied by the workspace so a figure can be edited in place. */
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
    return (
      <DataTable
        key={`table-${index}`}
        headers={block.headers}
        rows={block.rows}
        alignments={block.alignments}
      />
    )
  }
  return <MarkdownText key={`markdown-${index}`} content={block.content} />
}

export const ContentBlocks = memo(function ContentBlocks({
  blocks,
  streaming = false,
  onEditFigure,
}: ContentBlocksProps) {
  let figureIndex = 0
  return (
    <>
      {blocks.map((block, index) => {
        const currentFigure =
          block.type === 'mermaid' || block.type === 'chart' ? figureIndex++ : null
        return renderBlock(block, index, streaming, currentFigure, onEditFigure)
      })}
    </>
  )
})
