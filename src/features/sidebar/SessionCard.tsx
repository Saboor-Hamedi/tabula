import type { Session } from '../../core/types'
import { formatCount, formatRelativeTime } from '../../core/utils/format'
import { DatabaseIcon, FileIcon } from '../common/Icons'
import { DeleteSessionButton } from '../session/DeleteSessionButton'

export interface SessionCardProps {
  session: Session
  active: boolean
  onSelect: (sessionId: string) => void
}

export function SessionCard({ session, active, onSelect }: SessionCardProps) {
  const totalRows = session.tables.reduce((total, table) => total + table.rowCount, 0)

  return (
    <div className={`session-card ${active ? 'is-active' : ''}`}>
      <button
        type="button"
        className="session-card-main"
        onClick={() => onSelect(session.id)}
        aria-current={active ? 'true' : undefined}
      >
        <span className="session-icon" aria-hidden>
          <FileIcon size={16} />
        </span>
        <span className="session-copy">
          <span className="session-name" title={session.fileName}>
            {session.fileName}
          </span>
          <span className="session-meta">
            <span className="session-type">{session.fileType.toUpperCase()}</span>
            <span className="session-dot" />
            <span>{formatRelativeTime(session.uploadedAt)}</span>
          </span>
          <span className="session-stats">
            <span>
              <DatabaseIcon size={12} />
              {session.tables.length} table{session.tables.length === 1 ? '' : 's'}
            </span>
            <span>{formatCount(totalRows)} rows</span>
          </span>
        </span>
      </button>
      <div className="session-actions">
        <DeleteSessionButton sessionId={session.id} />
      </div>
      {active ? <span className="session-active-bar" aria-hidden /> : null}
    </div>
  )
}
