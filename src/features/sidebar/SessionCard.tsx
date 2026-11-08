import type { Session } from '../../core/types'
import { formatCount, formatRelativeTime } from '../../core/utils/format'
import { SheetIcon } from '../common/Icons'
import { DeleteSessionButton } from '../session/DeleteSessionButton'

/**
 * One dataset row in the sidebar.
 *
 * Kept intentionally quiet: file name, format, size, row count. The active row
 * gets a left accent bar rather than a filled card, so the list stays calm when
 * there are many datasets.
 */

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
        title={session.fileName}
      >
        <span className="session-icon" aria-hidden>
          <SheetIcon size={15} />
        </span>
        <span className="session-copy">
          <span className="session-name">{session.fileName}</span>
          <span className="session-meta">
            {session.fileType.toUpperCase()}
            <span className="dot" />
            {formatCount(totalRows)} rows
            <span className="dot" />
            {formatRelativeTime(session.uploadedAt)}
          </span>
        </span>
      </button>

      <div className="session-actions">
        <DeleteSessionButton sessionId={session.id} />
      </div>
    </div>
  )
}
