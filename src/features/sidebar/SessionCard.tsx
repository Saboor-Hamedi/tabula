import type { Session } from '../../core/types'
import { formatCount, formatRelativeTime } from '../../core/utils/format'
import { ExternalIcon, SheetIcon } from '../common/Icons'
import { DeleteSessionButton } from '../session/DeleteSessionButton'
import { useSessionActions } from '../SessionProvider'

/**
 * One dataset row in the sidebar.
 */

export interface SessionCardProps {
  session: Session
  active: boolean
  onSelect: (sessionId: string) => void
}

export function SessionCard({ session, active, onSelect }: SessionCardProps) {
  const { openSpreadsheet } = useSessionActions()
  const totalRows = (session?.tables ?? []).reduce((total, table) => total + (table?.rowCount ?? 0), 0)

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
        {(session.tables?.length ?? 0) > 0 ? (
          <button
            type="button"
            className="icon-btn is-sm"
            aria-label={`Open ${session.fileName} in spreadsheet view`}
            title="Open Excel view"
            onClick={(e) => {
              e.stopPropagation()
              openSpreadsheet({
                kind: 'session',
                title: session.fileName,
                schemaName: session.schemaName,
                tables: session.tables,
                initialTableName: session.primaryTable ?? session.tables[0]?.name,
              })
            }}
          >
            <ExternalIcon size={13} />
          </button>
        ) : null}
        <DeleteSessionButton sessionId={session.id} />
      </div>
    </div>
  )
}
