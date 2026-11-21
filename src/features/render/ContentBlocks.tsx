import { memo } from 'react'
import type { FigureChanges } from '../../core/parsing/editFigure'
import type { ContentBlock, ExecutedCodeStep, ExecutedCodeTable } from '../../core/types'
import { ChartBlock } from './ChartBlock'
import { CodeBlock } from './CodeBlock'
import { DataTable } from './DataTable'
import { MarkdownText } from './MarkdownText'
import { MermaidBlock } from '../mermaid/MermaidBlock'

/**
 * Renders a list of parsed content blocks along with executed SQL/Python code
 * wrappers and their associated figures and tables.
 *
 * When executed tool steps (`codeSteps`) exist, each code wrapper is rendered
 * with its figures and tables directly underneath it, while the prose summary
 * is rendered cleanly outside the code wrapper.
 */

export interface ContentBlocksProps {
  blocks: ContentBlock[]
  /** While streaming, hold back chart rendering until fences close. */
  streaming?: boolean
  /** Supplied by the workspace so a figure can be edited in place. */
  onEditFigure?: (figureIndex: number, changes: FigureChanges) => void
  /** Optional Python-generated plot images to attach to code wrappers or interleave. */
  images?: string[]
  /** Executed SQL and Python tool steps from this turn. */
  codeSteps?: ExecutedCodeStep[]
  onOpenImage?: (index: number) => void
}

/**
 * Removes redundant or unclosed ```python / ```sql / ``` code fences from prose
 * when we already have the authoritative executed `codeSteps` from the tool runner,
 * preventing any malformed fence from swallowing the summary text into a code wrapper.
 */
function stripRedundantCodeFencesFromProse(markdown: string): string {
  return markdown
    .replace(/```(?:python|py|sql|duckdb|summary|text|markdown)?\b[\s\S]*?(?:```|$)/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function tablesOverlap(a: ExecutedCodeTable, b: { headers: string[]; rows: string[][] }): boolean {
  if (a.headers.length === 0 || b.headers.length === 0) return false
  if (a.headers.length === b.headers.length) return true
  const setA = new Set(a.headers.map((h) => h.trim().toLowerCase().replace(/[_-]/g, ' ')))
  const matches = b.headers.filter((h) =>
    setA.has(h.trim().toLowerCase().replace(/[_-]/g, ' ')),
  ).length
  return matches >= Math.max(1, Math.floor(Math.min(a.headers.length, b.headers.length) / 2))
}

function renderInlinePlot(
  src: string,
  imgIdx: number,
  onOpenImage?: (index: number) => void,
) {
  return (
    <div key={`py-plot-${imgIdx}`} className="python-plots-list" style={{ margin: '10px 0' }}>
      <div className="code-figure-card">
        <button
          type="button"
          className="code-figure-img-btn"
          onClick={() => onOpenImage?.(imgIdx)}
          title="Click to inspect full size"
        >
          <img
            src={src}
            alt={`Generated chart ${imgIdx + 1}`}
            className="code-figure-img"
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
  codeSteps,
  onOpenImage,
}: ContentBlocksProps) {
  const safeSteps: ExecutedCodeStep[] = Array.isArray(codeSteps)
    ? codeSteps.map((s) => ({ ...s }))
    : []
  const safeImages = !streaming && Array.isArray(images) ? images : []

  const usedImageUrls = new Set<string>()
  for (const step of safeSteps) {
    if (Array.isArray(step.images)) {
      for (const img of step.images) usedImageUrls.add(img)
    }
  }

  // Absorb standalone GFM tables into code steps so tables display directly under
  // the code wrapper without duplicate rendering.
  const absorbedTableBlockIndices = new Set<number>()
  if (safeSteps.length > 0) {
    blocks.forEach((block, idx) => {
      if (block.type !== 'table') return
      const stepWithoutTable = safeSteps.find((s) => !s.table || s.table.headers.length === 0)
      if (stepWithoutTable) {
        stepWithoutTable.table = {
          headers: block.headers,
          rows: block.rows,
          totalRows: block.rows.length,
          totalCols: block.headers.length,
        }
        absorbedTableBlockIndices.add(idx)
        return
      }
      const overlappingStep = safeSteps.find(
        (s) => s.table && tablesOverlap(s.table, block),
      )
      if (overlappingStep && overlappingStep.table) {
        if (
          block.rows.length > 0 &&
          block.rows.length >= overlappingStep.table.rows.length &&
          block.headers.length === overlappingStep.table.headers.length
        ) {
          overlappingStep.table = {
            headers: block.headers,
            rows: block.rows,
            totalRows: overlappingStep.table.totalRows ?? block.rows.length,
            totalCols: block.headers.length,
          }
        }
        absorbedTableBlockIndices.add(idx)
      }
    })
  }

  let figureIndex = 0
  const renderedNodes: React.ReactNode[] = []

  // 1. Render executed SQL & Python code wrappers (collapsed dropdown by default)
  //    with their figures and tables displayed directly under each code wrapper.
  if (safeSteps.length > 0) {
    safeSteps.forEach((step, sIdx) => {
      renderedNodes.push(
        <CodeBlock
          key={`step-${step.id || sIdx}`}
          code={step.code}
          className={`language-${step.language}`}
          purpose={step.purpose}
          status={step.status}
          initialElapsedMs={step.elapsedMs}
          initialTable={step.table}
          initialImages={step.images}
          initialStdout={step.stdout}
          defaultCollapsed={true}
        />,
      )
    })
  }

  // 2. Render the prose summary, charts, and any remaining blocks completely outside the code wrapper.
  blocks.forEach((block, index) => {
    if (absorbedTableBlockIndices.has(index)) {
      return
    }

    const currentFigure =
      block.type === 'mermaid' || block.type === 'chart' ? figureIndex++ : null

    if (block.type === 'mermaid') {
      renderedNodes.push(
        <MermaidBlock
          key={`mermaid-${index}`}
          code={block.code}
          streaming={streaming}
          onEdit={
            onEditFigure && currentFigure !== null
              ? (changes) => onEditFigure(currentFigure, changes)
              : undefined
          }
        />,
      )
      return
    }

    if (block.type === 'chart') {
      renderedNodes.push(
        <ChartBlock
          key={`chart-${index}`}
          chart={block.chart}
          onEdit={
            onEditFigure && currentFigure !== null
              ? (changes) => onEditFigure(currentFigure, changes)
              : undefined
          }
        />,
      )
      return
    }

    if (block.type === 'table') {
      renderedNodes.push(
        <DataTable
          key={`table-${index}`}
          headers={block.headers}
          rows={block.rows}
          alignments={block.alignments}
        />,
      )
      return
    }

    const cleanProse =
      safeSteps.length > 0
        ? stripRedundantCodeFencesFromProse(block.content)
        : block.content
    if (cleanProse.length > 0) {
      renderedNodes.push(<MarkdownText key={`markdown-${index}`} content={cleanProse} />)
    }
  })

  // Fallback for legacy persisted messages that had images without codeSteps
  const remainingImages = safeImages.filter((img) => !usedImageUrls.has(img))
  const hasInlineCharts = blocks.some((b) => b.type === 'mermaid' || b.type === 'chart')
  if (remainingImages.length > 0 && !hasInlineCharts) {
    remainingImages.forEach((src, offset) => {
      renderedNodes.push(renderInlinePlot(src, offset, onOpenImage))
    })
  }

  return <>{renderedNodes}</>
})
