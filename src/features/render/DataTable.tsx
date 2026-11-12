import { memo, useCallback, useContext, useMemo, useState } from 'react'
import { MAX_PREVIEW_ROWS } from '../../core/constants'
import { buildCsv, downloadCsv } from '../../core/export/csv'
import { parseInlineMarkdown, stripInlineMarkdown } from '../../core/parsing/inlineMarkdown'
import { formatCount } from '../../core/utils/format'
import { CheckIcon, CopyIcon, DownloadIcon, SheetIcon } from '../common/Icons'
import { SessionActionsContext } from '../session/sessionContext'

/**
 * Table rendered from a GFM block in an assistant message.
 *
 * Cells go through `parseInlineMarkdown`, so `**bold**` renders as bold instead
 * of leaking asterisks into the cell. Numeric cells are right-aligned and use
 * tabular figures so columns of numbers line up.
 */

export interface DataTableProps {
  headers: string[]
  rows: string[][]
  alignments?: ('left' | 'right' | 'center')[]
}

export type ColumnAlign = 'left' | 'right' | 'center'

export function isNumericOrStatValue(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed || trimmed === '—' || trimmed === '-' || trimmed === 'N/A' || trimmed === 'NA' || trimmed === 'null') {
    return true
  }
  // Strip common currency symbols, commas, and enclosing whitespace
  const cleaned = trimmed.replace(/^[$€£₨¥]/, '').replace(/,/g, '').trim()
  // Pure float, integer, percentage, or scientific notation: e.g. 16.70, 17, -1.28, 100%, 1.2e-4
  if (/^-?\d+(\.\d+)?%?([eE][+-]?\d+)?$/.test(cleaned)) return true
  // Ratio / counts: e.g. 395 / 395, 395/395, 20/50
  if (/^\d+(\.\d+)?\s*\/\s*\d+(\.\d+)?$/.test(trimmed)) return true
  // Range: e.g. 10 - 20, 16.7–18.2
  if (/^-?\d+(\.\d+)?\s*[-–—]\s*-?\d+(\.\d+)?$/.test(trimmed)) return true
  // Mean ± SD / parens: e.g. 16.70 ± 1.28, 16.70 (1.28), 16.70 +/- 1.28
  if (/^-?\d+(\.\d+)?\s*(±|\+\/-|\()\s*-?\d+(\.\d+)?\)?$/.test(trimmed)) return true
  return false
}

/** Renders a cell's inline markdown tokens. */
function CellValue({ value }: { value: string }) {
  const tokens = useMemo(() => parseInlineMarkdown(value), [value])

  if (tokens.length === 0) return <span className="cell-empty">—</span>

  return (
    <>
      {tokens.map((token, index) => {
        if (token.type === 'strong') return <strong key={index}>{token.value}</strong>
        if (token.type === 'em') return <em key={index}>{token.value}</em>
        if (token.type === 'code') return <code key={index}>{token.value}</code>
        return <span key={index}>{token.value}</span>
      })}
    </>
  )
}

export const DataTable = memo(function DataTable({
  headers = [],
  rows = [],
  alignments = [],
}: DataTableProps) {
  const sessionActions = useContext(SessionActionsContext)
  const [copied, setCopied] = useState(false)
  const safeHeaders = Array.isArray(headers) ? headers : []
  const safeRows = Array.isArray(rows) ? rows : []
  const visibleRows = useMemo(() => safeRows.slice(0, MAX_PREVIEW_ROWS), [safeRows])

  // Automatically detect proper alignment for each column (no hardcoding):
  // 1. Column 0 is the row label / measure name (always left)
  // 2. Data columns (col > 0) are analyzed across all rows: if values are numbers, ratios, or stats -> 'right'
  // 3. Explicit markdown alignment separator (:---:, ---:) is respected if provided.
  const columnAlignments = useMemo<ColumnAlign[]>(() => {
    return safeHeaders.map((_header, colIndex) => {
      const explicit = alignments[colIndex]
      if (explicit) return explicit

      if (colIndex === 0) return 'left'

      let statCount = 0
      let totalNonEmpty = 0

      for (const row of safeRows) {
        const cell = (row[colIndex] ?? '').trim()
        if (cell) {
          totalNonEmpty++
          if (isNumericOrStatValue(cell)) {
            statCount++
          }
        }
      }

      if (totalNonEmpty > 0 && statCount / totalNonEmpty >= 0.5) {
        return 'right'
      }

      return 'left'
    })
  }, [safeHeaders, safeRows, alignments])

  const handleCopyTable = useCallback(async () => {
    if (safeHeaders.length === 0) return

    const allRows = [safeHeaders, ...safeRows]
    const html = `<table style="border-collapse: collapse; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 10pt;">${allRows
      .map(
        (row, rIdx) => `<tr>${row
          .map((cell, cIdx) => {
            const isHeader = rIdx === 0
            const tag = isHeader ? 'th' : 'td'
            const align = columnAlignments[cIdx] ?? 'left'
            const bg = isHeader
              ? 'background-color: #f3f4f6; font-weight: 600;'
              : rIdx % 2 === 0
              ? 'background-color: #fbfbfc;'
              : 'background-color: #ffffff;'
            return `<${tag} style="border: 1px solid #d1d5db; padding: 6px 12px; text-align: ${align}; ${bg}">${cell}</${tag}>`
          })
          .join('')}</tr>`,
      )
      .join('')}</table>`

    const tsv = allRows.map((row) => row.join('\t')).join('\n')

    try {
      if (typeof ClipboardItem !== 'undefined') {
        const item = new ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([tsv], { type: 'text/plain' }),
        })
        await navigator.clipboard.write([item])
      } else {
        await navigator.clipboard.writeText(tsv)
      }
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      await navigator.clipboard.writeText(tsv)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    }
  }, [safeHeaders, safeRows, columnAlignments])

  const handleDownload = useCallback(() => {
    downloadCsv('tabula-table.csv', buildCsv(safeHeaders, safeRows))
  }, [safeHeaders, safeRows])

  const handleOpenSheet = useCallback(() => {
    if (!sessionActions || safeHeaders.length === 0) return
    sessionActions.openSpreadsheet({
      kind: 'static',
      title: 'Generated Result Table',
      sheets: [
        {
          name: 'Results',
          headers: safeHeaders.map((h) => stripInlineMarkdown(h)),
          rows: safeRows.map((row) =>
            safeHeaders.map((_h, idx) => stripInlineMarkdown(row[idx] ?? '')),
          ),
        },
      ],
    })
  }, [sessionActions, safeHeaders, safeRows])

  if (safeHeaders.length === 0) return null

  return (
    <div className="data-table-block">
      <div className="data-table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              {safeHeaders.map((header, index) => {
                const align = columnAlignments[index] ?? 'left'
                return (
                  <th
                    key={`${header}-${index}`}
                    scope="col"
                    className={`col-align-${align} ${align === 'right' ? 'is-numeric' : ''}`}
                  >
                    <CellValue value={header} />
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {safeHeaders.map((header, cellIndex) => {
                  const value = row[cellIndex] ?? ''
                  const align = columnAlignments[cellIndex] ?? 'left'
                  const isNum = align === 'right' || isNumericOrStatValue(value)
                  return (
                    <td
                      key={`${rowIndex}-${header}-${cellIndex}`}
                      className={`col-align-${align} ${isNum ? 'is-numeric' : ''}`}
                    >
                      <CellValue value={value} />
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="data-table-foot">
        <span>
          {safeRows.length > MAX_PREVIEW_ROWS
            ? `Showing ${formatCount(MAX_PREVIEW_ROWS)} of ${formatCount(safeRows.length)} rows`
            : `${formatCount(safeRows.length)} row${safeRows.length === 1 ? '' : 's'}`}
        </span>
        <div className="data-table-foot-actions">
          {sessionActions ? (
            <button
              type="button"
              className="tool-btn"
              onClick={handleOpenSheet}
              title="Open table in Excel-style view (sort, filter, head/tail, .xlsx)"
            >
              <SheetIcon size={13} />
              <span>Open in Excel</span>
            </button>
          ) : null}
          <button
            type="button"
            className="tool-btn"
            onClick={handleCopyTable}
            title="Copy Word & Google Docs ready formatted table"
          >
            {copied ? <CheckIcon size={13} /> : <CopyIcon size={13} />}
            <span>{copied ? 'Copied Table!' : 'Copy as table'}</span>
          </button>
          <button type="button" className="tool-btn" onClick={handleDownload} title="Download data as CSV">
            <DownloadIcon size={13} />
            <span>Download CSV</span>
          </button>
        </div>
      </div>
    </div>
  )
})
