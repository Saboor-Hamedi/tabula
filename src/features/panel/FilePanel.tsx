import { useMemo } from 'react'
import { formatCount } from '../../core/utils/format'
import { TableIcon } from '../common/Icons'
import { useSessionState } from '../SessionProvider'

/**
 * Tables & schema inspector.
 *
 * Shows the tables and columns the agent is working from. Column metadata comes from
 * the live digest, so what is shown here is exactly what the agent sees.
 */

export function FilePanel() {
  const { activeSession, digest } = useSessionState()

  const totalRows = useMemo(
    () =>
      (activeSession?.tables ?? []).reduce((total, table) => total + (table?.rowCount ?? 0), 0),
    [activeSession],
  )

  if (!activeSession) {
    return (
      <div className="panel-empty">
        <TableIcon size={22} />
        <p>No tables loaded</p>
        <span>Upload a spreadsheet to inspect its schema and columns here.</span>
      </div>
    )
  }

  return (
    <div className="file-panel">
      <div className="file-facts">
        <div className="file-fact">
          <span className="file-fact-label">Tables</span>
          <span className="file-fact-value">{activeSession.tables?.length ?? 0}</span>
        </div>
        <div className="file-fact">
          <span className="file-fact-label">Total Rows</span>
          <span className="file-fact-value">{formatCount(totalRows)}</span>
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
              {(table.columns ?? []).map((column) => (
                <li key={column.name} className="file-column">
                  <span className="file-column-name">{column.name}</span>
                  <span className="file-column-type">{column.type.toLowerCase()}</span>
                </li>
              ))}
              {(table.columns?.length ?? 0) === 0 ? (
                <li className="file-column is-empty">No columns readable</li>
              ) : null}
            </ul>
          </section>
        ))}

        {!digest ? (
          <div className="file-panel-note">Reading columns…</div>
        ) : (digest.tables?.length ?? 0) < (activeSession.tables?.length ?? 0) ? (
          <div className="file-panel-note">
            Showing the {formatCount(digest.tables?.length ?? 0)} largest of{' '}
            {formatCount(activeSession.tables?.length ?? 0)} tables. Ask about a specific sheet or column
            for more detail.
          </div>
        ) : null}
      </div>
    </div>
  )
}
