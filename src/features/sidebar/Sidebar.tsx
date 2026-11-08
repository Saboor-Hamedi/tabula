import { useRef } from 'react'
import { ACCEPTED_EXTENSIONS } from '../../core/constants'
import { formatCount } from '../../core/utils/format'
import { CloseIcon, DatabaseIcon, PlusIcon, SettingsIcon, UploadIcon } from '../common/Icons'
import { useSession } from '../SessionProvider'
import { UploadStatus } from '../upload/UploadStatus'
import { SessionCard } from './SessionCard'

export interface SidebarProps {
  open: boolean
  onClose: () => void
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const {
    sessions,
    activeSession,
    selectSession,
    uploadFile,
    upload,
    openSettings,
  } = useSession()
  const inputRef = useRef<HTMLInputElement>(null)

  const totalRows = sessions.reduce(
    (total, session) =>
      total + session.tables.reduce((sum, table) => sum + table.rowCount, 0),
    0,
  )

  return (
    <aside className={`sidebar ${open ? 'is-open' : ''}`} aria-label="Datasets">
      <div className="sidebar-header">
        <div className="brand">
          <span className="brand-mark" aria-hidden>
            <DatabaseIcon size={18} />
          </span>
          <span className="brand-copy">
            <span className="brand-name">Tabula</span>
            <span className="brand-tagline">Chat with your data</span>
          </span>
        </div>
        <button type="button" className="btn-icon sidebar-close" onClick={onClose} aria-label="Close sidebar">
          <CloseIcon size={18} />
        </button>
      </div>

      <div className="sidebar-upload">
        <button
          type="button"
          className="btn btn-primary btn-block"
          onClick={() => inputRef.current?.click()}
        >
          <UploadIcon size={15} />
          <span>Add dataset</span>
        </button>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_EXTENSIONS.join(',')}
          className="visually-hidden"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) {
              void uploadFile(file)
              onClose()
            }
            event.target.value = ''
          }}
        />
        <UploadStatus state={upload} />
      </div>

      <div className="sidebar-section-head">
        <span>Datasets</span>
        <span className="sidebar-count">
          {sessions.length} · {formatCount(totalRows)} rows
        </span>
      </div>

      <div className="sidebar-list">
        {sessions.length === 0 ? (
          <div className="sidebar-empty">
            <PlusIcon size={16} />
            <p>No datasets yet. Add a CSV or Excel workbook to start.</p>
          </div>
        ) : (
          sessions.map((session) => (
            <SessionCard
              key={session.id}
              session={session}
              active={session.id === activeSession?.id}
              onSelect={(sessionId) => {
                selectSession(sessionId)
                onClose()
              }}
            />
          ))
        )}
      </div>

      <div className="sidebar-footer">
        <div className="local-note">
          <span className="local-dot" aria-hidden />
          <span>Session is in-memory only</span>
        </div>
        <button type="button" className="btn btn-ghost btn-block" onClick={openSettings}>
          <SettingsIcon size={15} />
          <span>Settings</span>
        </button>
      </div>
    </aside>
  )
}
