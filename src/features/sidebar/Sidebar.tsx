import { useMemo } from 'react'
import { formatCount } from '../../core/utils/format'
import { DatabaseIcon } from '../common/Icons'
import { useSessionActions, useSessionState } from '../SessionProvider'
import { UploadStatus } from '../upload/UploadStatus'
import { SessionCard } from './SessionCard'
import { SidebarFooter } from './SidebarFooter'
import { SidebarHeader } from './SidebarHeader'

/**
 * Sidebar: the dataset list.
 *
 * Split into header / body / footer so each piece stays small and the header can
 * share its height with the app header. The shell decides whether this renders
 * as a persistent column or an overlay drawer.
 */

export interface SidebarProps {
  onClose: () => void
  /** True when rendered as an overlay drawer, which needs its own close button. */
  closable?: boolean
}

export function Sidebar({ onClose, closable = false }: SidebarProps) {
  const { sessions, activeSession, upload } = useSessionState()
  const { selectSession } = useSessionActions()

  const totalRows = useMemo(
    () =>
      sessions.reduce(
        (total, session) =>
          total + session.tables.reduce((sum, table) => sum + table.rowCount, 0),
        0,
      ),
    [sessions],
  )

  return (
    <aside className="sidebar" aria-label="Datasets">
      <SidebarHeader onClose={onClose} closable={closable} />

      <div className="sidebar-body">
        <div className="sidebar-section-head">
          <span className="sidebar-section-label">Datasets</span>
          <span className="sidebar-section-count">
            {sessions.length} · {formatCount(totalRows)} rows
          </span>
        </div>

        <div className="sidebar-list">
          {sessions.length === 0 ? (
            <div className="sidebar-empty">
              <DatabaseIcon size={18} />
              <p>No datasets yet</p>
              <span>Add a CSV or Excel workbook to start.</span>
            </div>
          ) : (
            sessions.map((session) => (
              <SessionCard
                key={session.id}
                session={session}
                active={session.id === activeSession?.id}
                onSelect={selectSession}
              />
            ))
          )}
        </div>

        <UploadStatus state={upload} />
      </div>

      <SidebarFooter />
    </aside>
  )
}
