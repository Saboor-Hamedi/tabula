import { useMemo } from 'react'
import { formatCount } from '../../core/utils/format'
import { CheckIcon, ExternalIcon, SheetIcon, SparklesIcon, TableIcon } from '../common/Icons'
import { useSessionActions, useSessionState } from '../SessionProvider'

/**
 * Tables & schema inspector.
 *
 * Shows the tables and columns the agent is working from in plain, non-technical
 * language, along with a Data Health card and 1-click data cleaning action.
 */

export function friendlyColumnType(rawType: string): string {
  const upper = (rawType || '').toUpperCase()
  if (
    upper.includes('INT') ||
    upper.includes('DOUBLE') ||
    upper.includes('FLOAT') ||
    upper.includes('DEC') ||
    upper.includes('NUM') ||
    upper.includes('REAL')
  ) {
    return 'Number'
  }
  if (upper.includes('DATE') || upper.includes('TIME') || upper.includes('INTERVAL')) {
    return 'Date'
  }
  if (upper.includes('BOOL')) {
    return 'Yes/No'
  }
  return 'Text'
}

export function FilePanel() {
  const { activeSession, digest, isStreaming } = useSessionState()
  const { openSpreadsheet, sendMessage } = useSessionActions()

  const openSessionWorkbook = (initialTableName?: string) => {
    if (!activeSession || (activeSession.tables?.length ?? 0) === 0) return
    openSpreadsheet({
      kind: 'session',
      title: activeSession.fileName,
      schemaName: activeSession.schemaName,
      tables: activeSession.tables,
      initialTableName: initialTableName ?? activeSession.primaryTable ?? activeSession.tables[0]?.name,
    })
  }

  const totalRows = useMemo(
    () =>
      (activeSession?.tables ?? []).reduce((total, table) => total + (table?.rowCount ?? 0), 0),
    [activeSession],
  )

  const healthMetrics = useMemo(() => {
    const allCols = (digest?.tables ?? []).flatMap((t) => t.columns ?? [])
    if (allCols.length === 0) {
      return { completenessPct: 100, missingColsCount: 0, totalCols: 0 }
    }
    const totalNullPct = allCols.reduce((sum, c) => sum + Math.max(0, Math.min(100, c.nullPct ?? 0)), 0)
    const avgNullPct = totalNullPct / allCols.length
    const completenessPct = Math.max(0, Math.min(100, Math.round((100 - avgNullPct) * 10) / 10))
    const missingColsCount = allCols.filter((c) => (c.nullPct ?? 0) > 0).length
    return { completenessPct, missingColsCount, totalCols: allCols.length }
  }, [digest])

  const handleCleanData = () => {
    if (isStreaming) return
    void sendMessage(
      'Clean and standardize this dataset: fix missing values, remove any duplicate rows, standardize text and number formatting, and show a summary of what was cleaned along with the updated table.',
    )
  }

  if (!activeSession) {
    return (
      <div className="panel-empty">
        <TableIcon size={22} />
        <p>No tables loaded</p>
        <span>Upload a spreadsheet to inspect its fields and data health here.</span>
      </div>
    )
  }

  return (
    <div className="file-panel">
      <button
        type="button"
        className="file-card"
        onClick={() => openSessionWorkbook()}
        title="Open full Excel-style spreadsheet view (sort, filter, head/tail, stats)"
      >
        <span className="file-card-icon" aria-hidden>
          <SheetIcon size={17} />
        </span>
        <span className="file-card-body">
          <span className="file-card-name">{activeSession.fileName}</span>
          <span className="file-card-meta">
            <span>{activeSession.fileType.toUpperCase()}</span>
            <span>·</span>
            <span>{formatCount(totalRows)} rows</span>
          </span>
          <span className="file-card-hint">
            <ExternalIcon size={12} />
            <span>Open Excel view</span>
          </span>
        </span>
      </button>

      <div className="file-facts">
        <div className="file-fact">
          <span className="file-fact-label">Sheets</span>
          <span className="file-fact-value">{activeSession.tables?.length ?? 0}</span>
        </div>
        <div className="file-fact">
          <span className="file-fact-label">Total Rows</span>
          <span className="file-fact-value">{formatCount(totalRows)}</span>
        </div>
      </div>

      {digest && healthMetrics.totalCols > 0 ? (
        <div className="file-health-card">
          <div className="file-health-head">
            <span className="file-health-title">Data Health</span>
            <span
              className={`file-health-badge ${
                healthMetrics.missingColsCount === 0 ? 'is-good' : 'is-warn'
              }`}
            >
              {healthMetrics.completenessPct}% Complete
            </span>
          </div>
          <div className="file-health-bar" aria-hidden>
            <div
              className="file-health-bar-fill"
              style={{ width: `${Math.max(4, healthMetrics.completenessPct)}%` }}
            />
          </div>
          <span className="file-health-desc">
            {healthMetrics.missingColsCount === 0
              ? `All ${healthMetrics.totalCols} fields are 100% populated.`
              : `${healthMetrics.missingColsCount} of ${healthMetrics.totalCols} fields have missing cells.`}
          </span>
          <button
            type="button"
            className="file-health-clean-btn"
            onClick={handleCleanData}
            disabled={isStreaming}
            title="Automatically clean missing values, duplicates, and formatting"
          >
            {healthMetrics.missingColsCount === 0 ? (
              <CheckIcon size={12} />
            ) : (
              <SparklesIcon size={12} />
            )}
            <span>Clean & Fix Missing Values</span>
          </button>
        </div>
      ) : null}

      <div className="file-tables">
        {(digest?.tables ?? []).map((table) => (
          <section key={table.name} className="file-table">
            <header className="file-table-head">
              <TableIcon size={14} />
              <span className="file-table-name">{table.name}</span>
              <span className="file-table-rows">{formatCount(table.rowCount)}</span>
              <button
                type="button"
                className="tool-btn"
                onClick={() => openSessionWorkbook(table.name)}
                title={`Open ${table.name} in Excel view`}
              >
                <ExternalIcon size={11} />
                <span>Open</span>
              </button>
            </header>

            <ul className="file-columns">
              {(table.columns ?? []).map((column) => {
                const filledPct = Math.max(0, Math.min(100, Math.round(100 - (column.nullPct ?? 0))))
                return (
                  <li key={column.name} className="file-column">
                    <span className="file-column-name">{column.name}</span>
                    <span className="file-column-type">
                      {friendlyColumnType(column.type)}
                      {column.nullPct !== undefined && column.nullPct !== null && column.nullPct > 0
                        ? ` · ${filledPct}%`
                        : ''}
                    </span>
                  </li>
                )
              })}
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
            {formatCount(activeSession.tables?.length ?? 0)} sheets. Ask about a specific sheet or field
            for more detail.
          </div>
        ) : null}
      </div>
    </div>
  )
}
