import { memo, useMemo } from 'react'
import { MAX_PREVIEW_ROWS } from '../../core/constants'
import { formatCount } from '../../core/utils/format'

export interface DataTableProps {
  headers: string[]
  rows: string[][]
}

function isNumericCell(value: string): boolean {
  const trimmed = value.trim().replace(/[,%$€£]/g, '')
  if (trimmed.length === 0) return false
  return /^-?\d+(\.\d+)?$/.test(trimmed)
}

export const DataTable = memo(function DataTable({ headers, rows }: DataTableProps) {
  const visibleRows = useMemo(() => rows.slice(0, MAX_PREVIEW_ROWS), [rows])

  const renderedRows = useMemo(
    () =>
      visibleRows.map((row, rowIndex) => (
        <tr key={rowIndex}>
          {headers.map((header, cellIndex) => {
            const value = row[cellIndex] ?? ''
            const numeric = isNumericCell(value)
            return (
              <td key={`${rowIndex}-${header}-${cellIndex}`} className={numeric ? 'is-numeric' : ''}>
                {value.length > 0 ? value : <span className="cell-empty">—</span>}
              </td>
            )
          })}
        </tr>
      )),
    [headers, visibleRows],
  )

  if (headers.length === 0) return null

  return (
    <div className="data-table-block">
      <div className="data-table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              {headers.map((header, index) => (
                <th key={`${header}-${index}`} scope="col">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>{renderedRows}</tbody>
        </table>
      </div>
      {rows.length > MAX_PREVIEW_ROWS && (
        <div className="data-table-foot">
          Showing {formatCount(MAX_PREVIEW_ROWS)} of {formatCount(rows.length)} rows
        </div>
      )}
    </div>
  )
})
