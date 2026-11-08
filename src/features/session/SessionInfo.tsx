import { formatCount, formatRelativeTime } from '../../core/utils/format'
import { DatabaseIcon, FileIcon } from '../common/Icons'
import { useSession } from '../SessionProvider'
import { DeleteSessionButton } from './DeleteSessionButton'

export function SessionInfo() {
  const { activeSession } = useSession()

  if (!activeSession) {
    return (
      <div className="session-info is-empty">
        <div className="session-info-icon">
          <DatabaseIcon size={18} />
        </div>
        <div>
          <div className="session-info-title">No dataset loaded</div>
          <div className="session-info-meta">Upload a CSV or XLSX file to begin</div>
        </div>
      </div>
    )
  }

  const totalRows = activeSession.tables.reduce((total, table) => total + table.rowCount, 0)
  const tableNames = activeSession.tables.map((table) => table.name)

  return (
    <div className="session-info">
      <div className="session-info-icon">
        <FileIcon size={18} />
      </div>
      <div className="session-info-body">
        <div className="session-info-title" title={activeSession.fileName}>
          {activeSession.fileName}
        </div>
        <div className="session-info-meta">
          <span>{activeSession.fileType.toUpperCase()}</span>
          <span className="session-dot" />
          <span>{formatCount(totalRows)} rows</span>
          <span className="session-dot" />
          <span>
            {activeSession.tables.length} table{activeSession.tables.length === 1 ? '' : 's'}
          </span>
          <span className="session-dot" />
          <span>{formatRelativeTime(activeSession.uploadedAt)}</span>
        </div>
        <div className="session-table-chips">
          {tableNames.slice(0, 4).map((name) => (
            <span key={name} className="table-chip" title={name}>
              {name}
            </span>
          ))}
          {tableNames.length > 4 ? (
            <span className="table-chip is-more">+{tableNames.length - 4}</span>
          ) : null}
        </div>
      </div>
      <div className="session-info-actions">
        <DeleteSessionButton sessionId={activeSession.id} variant="label" />
      </div>
    </div>
  )
}
