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
  /** Optional Python-generated plot images to interleave between sections. */
  images?: string[]
  onOpenImage?: (index: number) => void
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

function renderInlinePlot(
  src: string,
  imgIdx: number,
  onOpenImage?: (index: number) => void,
) {
  return (
    <div key={`py-plot-${imgIdx}`} className="python-plots-list" style={{ margin: '12px 0' }}>
      <div className="python-plot-card">
        <button
          type="button"
          onClick={() => onOpenImage?.(imgIdx)}
          style={{
            padding: 0,
            border: 0,
            background: 'transparent',
            cursor: 'zoom-in',
            width: '100%',
          }}
          title="Click to inspect full size"
        >
          <img
            src={src}
            alt={`Generated chart ${imgIdx + 1}`}
            className="python-plot-image"
            loading="lazy"
          />
        </button>
      </div>
    </div>
  )
}

export const ContentBlocks = memo(function ContentBlocks({
  blocks,
  streaming = false,
  onEditFigure,
  images,
  onOpenImage,
}: ContentBlocksProps) {
  let figureIndex = 0
  const safeImages = !streaming && Array.isArray(images) ? images : []
  const hasInlineCharts = blocks.some((b) => b.type === 'mermaid' || b.type === 'chart')
  const shouldInterleaveImages = safeImages.length > 0 && !hasInlineCharts
  const hasTables = blocks.some((b) => b.type === 'table')
  let nextImageIdx = 0

  return (
    <>
      {blocks.map((block, index) => {
        const currentFigure =
          block.type === 'mermaid' || block.type === 'chart' ? figureIndex++ : null
        const node = renderBlock(block, index, streaming, currentFigure, onEditFigure)
        const placeAfterThisBlock =
          shouldInterleaveImages &&
          nextImageIdx < safeImages.length &&
          (hasTables
            ? block.type === 'table'
            : block.type === 'markdown' && index < blocks.length - 1)
        const inlinePlot = placeAfterThisBlock
          ? renderInlinePlot(safeImages[nextImageIdx], nextImageIdx++, onOpenImage)
          : null

        return inlinePlot ? (
          <div key={`block-wrap-${index}`}>
            {node}
            {inlinePlot}
          </div>
        ) : (
          node
        )
      })}
      {shouldInterleaveImages && nextImageIdx < safeImages.length
        ? safeImages
            .slice(nextImageIdx)
            .map((src, offset) =>
              renderInlinePlot(src, nextImageIdx + offset, onOpenImage),
            )
        : null}
    </>
  )
})
