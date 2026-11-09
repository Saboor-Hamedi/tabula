import { memo, useCallback, useMemo } from 'react'
import { MAX_PREVIEW_ROWS } from '../../core/constants'
import { buildCsv, downloadCsv } from '../../core/export/csv'
import { parseInlineMarkdown } from '../../core/parsing/inlineMarkdown'
import { formatCount } from '../../core/utils/format'
import { DownloadIcon } from '../common/Icons'

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
}

function isNumericCell(value: string): boolean {
  const trimmed = value.trim().replace(/[,%$€£₨]/g, '')
  if (trimmed.length === 0) return false
  return /^-?\d+(\.\d+)?$/.test(trimmed)
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

export const DataTable = memo(function DataTable({ headers = [], rows = [] }: DataTableProps) {
  const safeHeaders = Array.isArray(headers) ? headers : []
  const safeRows = Array.isArray(rows) ? rows : []
  const visibleRows = useMemo(() => safeRows.slice(0, MAX_PREVIEW_ROWS), [safeRows])
  const handleDownload = useCallback(() => {
    downloadCsv('tabula-table.csv', buildCsv(safeHeaders, safeRows))
  }, [safeHeaders, safeRows])

  if (safeHeaders.length === 0) return null

  return (
    <div className="data-table-block">
      <div className="data-table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              {safeHeaders.map((header, index) => (
                <th key={`${header}-${index}`} scope="col">
                  <CellValue value={header} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {headers.map((header, cellIndex) => {
                  const value = row[cellIndex] ?? ''
                  return (
                    <td
                      key={`${rowIndex}-${header}-${cellIndex}`}
                      className={isNumericCell(value) ? 'is-numeric' : ''}
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
          {rows.length > MAX_PREVIEW_ROWS
            ? `Showing ${formatCount(MAX_PREVIEW_ROWS)} of ${formatCount(rows.length)} rows`
            : `${formatCount(rows.length)} row${rows.length === 1 ? '' : 's'}`}
        </span>
        <button type="button" className="tool-btn" onClick={handleDownload}>
          <DownloadIcon size={13} />
          <span>Download data</span>
        </button>
      </div>
    </div>
  )
})
