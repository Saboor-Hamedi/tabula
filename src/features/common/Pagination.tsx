import { useMemo } from 'react'
import { formatCount } from '../../core/utils/format'

export interface PaginationProps {
  page: number
  pageSize: number
  totalItems: number
  onPageChange: (nextPage: number) => void
  onPageSizeChange?: (nextSize: number) => void
  pageSizeOptions?: number[]
  itemLabel?: string
}

type PageToken = number | 'ellipsis-left' | 'ellipsis-right'

function buildPageTokens(current: number, totalPages: number): PageToken[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1)
  }

  const tokens: PageToken[] = [1]
  const start = Math.max(2, current - 1)
  const end = Math.min(totalPages - 1, current + 1)

  if (start > 2) tokens.push('ellipsis-left')
  for (let p = start; p <= end; p += 1) tokens.push(p)
  if (end < totalPages - 1) tokens.push('ellipsis-right')
  tokens.push(totalPages)

  return tokens
}

/**
 * Shared, accessible pagination bar with smart ellipsis page numbers,
 * item range summary, and optional page-size selector.
 */
export function Pagination({
  page,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [8, 15, 30],
  itemLabel = 'items',
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / Math.max(1, pageSize)))
  const safePage = Math.min(Math.max(1, page), totalPages)
  const tokens = useMemo(() => buildPageTokens(safePage, totalPages), [safePage, totalPages])

  if (totalItems === 0) return null

  const startItem = (safePage - 1) * pageSize + 1
  const endItem = Math.min(totalItems, safePage * pageSize)

  return (
    <nav className="pagination-bar" aria-label={`${itemLabel} pagination`}>
      <div className="pagination-meta">
        <span>
          Showing <strong>{formatCount(startItem)}</strong>–<strong>{formatCount(endItem)}</strong>{' '}
          of <strong>{formatCount(totalItems)}</strong> {itemLabel}
        </span>

        {onPageSizeChange ? (
          <label className="pagination-size">
            <span>Rows</span>
            <select
              value={pageSize}
              onChange={(event) => onPageSizeChange(Number(event.target.value))}
              aria-label={`Items per page for ${itemLabel}`}
            >
              {pageSizeOptions.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      {totalPages > 1 ? (
        <div className="pagination-controls">
          <button
            type="button"
            className="pagination-btn"
            disabled={safePage <= 1}
            onClick={() => onPageChange(safePage - 1)}
            aria-label="Previous page"
          >
            Prev
          </button>

          {tokens.map((token) =>
            typeof token === 'number' ? (
              <button
                key={token}
                type="button"
                className={`pagination-btn ${token === safePage ? 'is-active' : ''}`}
                aria-current={token === safePage ? 'page' : undefined}
                onClick={() => onPageChange(token)}
              >
                {token}
              </button>
            ) : (
              <span key={token} className="pagination-ellipsis" aria-hidden="true">
                …
              </span>
            ),
          )}

          <button
            type="button"
            className="pagination-btn"
            disabled={safePage >= totalPages}
            onClick={() => onPageChange(safePage + 1)}
            aria-label="Next page"
          >
            Next
          </button>
        </div>
      ) : null}
    </nav>
  )
}
