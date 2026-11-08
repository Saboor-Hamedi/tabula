import { useMemo } from 'react'
import { formatBytes, formatCount, formatRelativeTime } from '../../core/utils/format'
import { ExternalIcon, SheetIcon, TableIcon } from '../common/Icons'
import { useSessionActions, useSessionState } from '../SessionProvider'

/**
 * File inspector.
 *
 * Shows the uploaded file as a card the user can click to open it in Excel, plus
 * the tables and columns the agent is working from. Column metadata comes from
 * the live digest, so what is shown here is exactly what the agent sees.
 */

export function FilePanel() {
  const { activeSession, digest } = useSessionState()
  const { openActiveFile } = useSessionActions()

  const totalRows = useMemo(
    () =>
      activeSession?.tables.reduce((total, table) => total + table.rowCount, 0) ?? 0,
    [activeSession],
  )

  if (!activeSession) {
    return (
      <div className="panel-empty">
        <SheetIcon size={22} />
        <p>No file loaded</p>
        <span>Upload a CSV or Excel workbook to inspect it here.</span>
      </div>
    )
  }

  return (
    <div className="file-panel">
      <button
        type="button"
        className="file-card"
        onClick={() => void openActiveFile()}
        title={`Open ${activeSession.fileName} in Excel`}
      >
        <span className="file-card-icon" aria-hidden>
          <SheetIcon size={20} />
        </span>
        <span className="file-card-body">
          <span className="file-card-name">{activeSession.fileName}</span>
          <span className="file-card-meta">
            {activeSession.fileType.toUpperCase()}
            <span className="dot" />
            {formatBytes(activeSession.fileSize)}
            <span className="dot" />
            {formatCount(totalRows)} rows
          </span>
          <span className="file-card-hint">
            <ExternalIcon size={12} />
            Open in Excel
          </span>
        </span>
      </button>

      <div className="file-facts">
        <div className="file-fact">
          <span className="file-fact-label">Tables</span>
          <span className="file-fact-value">{activeSession.tables.length}</span>
        </div>
        <div className="file-fact">
          <span className="file-fact-label">Rows</span>
          <span className="file-fact-value">{formatCount(totalRows)}</span>
        </div>
        <div className="file-fact">
          <span className="file-fact-label">Added</span>
          <span className="file-fact-value">{formatRelativeTime(activeSession.uploadedAt)}</span>
        </div>
      </div>

      <div className="file-tables">
        {(digest?.tables ?? []).map((table) => (
          <section key={table.name} className="file-table">
            <header className="file-table-head">
              <TableIcon size={14} />
              <span className="file-table-name">{table.name}</span>
              <span className="file-table-rows">{formatCount(table.rowCount)}</span>
            </header>

            <ul className="file-columns">
              {table.columns.map((column) => (
                <li key={column.name} className="file-column">
                  <span className="file-column-name">{column.name}</span>
                  <span className="file-column-type">{column.type.toLowerCase()}</span>
                </li>
              ))}
              {table.columns.length === 0 ? (
                <li className="file-column is-empty">No columns readable</li>
              ) : null}
            </ul>
          </section>
        ))}

        {!digest ? (
          <div className="file-panel-note">Profiling columns…</div>
        ) : null}
      </div>
    </div>
  )
}
