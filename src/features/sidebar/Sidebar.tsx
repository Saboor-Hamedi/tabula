import { useEffect, useMemo, useRef, useState } from 'react'
import { ACCEPTED_EXTENSIONS } from '../../core/constants'
import {
  exportAnalysisAsDoc,
  exportAnalysisAsPdf,
  exportAnalysisAsText,
} from '../../core/export/exportFormats'
import { formatCount } from '../../core/utils/format'
import {
  ChevronDownIcon,
  DatabaseIcon,
  DownloadIcon,
  FileIcon,
  PdfIcon,
  PlusIcon,
  SheetIcon,
} from '../common/Icons'
import { useSessionActions, useSessionState } from '../SessionProvider'
import { UploadStatus } from '../upload/UploadStatus'
import { SessionCard } from './SessionCard'
import { SidebarFooter } from './SidebarFooter'
import { SidebarHeader } from './SidebarHeader'

/**
 * Sidebar: the dataset list and top-level export controls.
 */

export interface SidebarProps {
  onClose: () => void
  closable?: boolean
  isCollapsed?: boolean
  onExpand?: () => void
}

export function Sidebar({
  onClose,
  closable = false,
  isCollapsed = false,
  onExpand,
}: SidebarProps) {
  const { sessions, activeSession, upload, messages } = useSessionState()
  const { selectSession, uploadFile } = useSessionActions()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    if (!menuOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [menuOpen])

  const totalRows = useMemo(
    () =>
      sessions.reduce(
        (total, session) =>
          total + (session?.tables ?? []).reduce((sum, table) => sum + (table?.rowCount ?? 0), 0),
        0,
      ),
    [sessions],
  )

  if (isCollapsed) {
    return (
      <aside className="sidebar is-collapsed" aria-label="Sources rail">
        <div className="sidebar-rail-header">
          <button
            type="button"
            className="brand-rail-btn"
            onClick={onExpand}
            title="Expand sources sidebar"
            aria-label="Expand sources sidebar"
          >
            <span className="brand-mark" aria-hidden>
              <FileIcon size={16} />
            </span>
          </button>
        </div>
      </aside>
    )
  }

  return (
    <aside className="sidebar" aria-label="Sources">
      <SidebarHeader onClose={onClose} closable={closable} />

      {/* Top File Export Card */}
      {activeSession ? (
        <div className="sidebar-top-export-card">
          <div className="top-export-row">
            <span className="top-export-icon" aria-hidden>
              <SheetIcon size={14} />
            </span>
            <div className="top-export-info">
              <span className="top-export-name" title={activeSession.fileName}>
                {activeSession.fileName}
              </span>
              <span className="top-export-stats">
                {activeSession.tables?.length || 1} table · {formatCount(activeSession.tables?.reduce((sum, t) => sum + (t.rowCount || 0), 0) || 0)} rows
              </span>
            </div>

            <div className="top-export-dropdown-wrapper" ref={menuRef}>
              <button
                type="button"
                className={`top-export-btn ${menuOpen ? 'is-active' : ''}`}
                onClick={() => setMenuOpen(!menuOpen)}
                aria-expanded={menuOpen}
                title="Export analysis document"
              >
                <span>Export</span>
                <ChevronDownIcon size={11} className={menuOpen ? 'icon-rotated' : ''} />
              </button>

              {menuOpen && (
                <div className="sidebar-dropdown-menu" role="menu">
                  <div className="dropdown-menu-header">Export Analysis</div>
                  <button
                    type="button"
                    className="dropdown-menu-item"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false)
                      void exportAnalysisAsPdf(activeSession, messages)
                    }}
                  >
                    <span className="dropdown-item-icon pdf-icon">
                      <PdfIcon size={13} />
                    </span>
                    <div className="dropdown-item-text">
                      <span className="dropdown-item-title">Export as PDF</span>
                      <span className="dropdown-item-hint">Executive report with charts & tables</span>
                    </div>
                  </button>
                  <button
                    type="button"
                    className="dropdown-menu-item"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false)
                      void exportAnalysisAsDoc(activeSession, messages)
                    }}
                  >
                    <span className="dropdown-item-icon doc-icon">
                      <FileIcon size={13} />
                    </span>
                    <div className="dropdown-item-text">
                      <span className="dropdown-item-title">Export to Word (.doc)</span>
                      <span className="dropdown-item-hint">Formatted document with tables</span>
                    </div>
                  </button>
                  <button
                    type="button"
                    className="dropdown-menu-item"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false)
                      exportAnalysisAsText(activeSession, messages)
                    }}
                  >
                    <span className="dropdown-item-icon txt-icon">
                      <DownloadIcon size={13} />
                    </span>
                    <div className="dropdown-item-text">
                      <span className="dropdown-item-title">Export to Text (.txt)</span>
                      <span className="dropdown-item-hint">Clean readable text summary</span>
                    </div>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      <div className="sidebar-body">
        <div className="sidebar-section-head">
          <span className="sidebar-section-label">Sources</span>
          <span className="sidebar-section-count">
            {sessions.length} source{sessions.length === 1 ? '' : 's'}
            {totalRows > 0 ? ` · ${formatCount(totalRows)} rows` : ''}
          </span>
        </div>

        {/* "Add Source" Button */}
        <button
          type="button"
          className="sidebar-add-source-btn"
          onClick={() => fileInputRef.current?.click()}
          title="Add a new spreadsheet or CSV source"
        >
          <PlusIcon size={14} />
          <span>Add Source</span>
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_EXTENSIONS.join(',')}
          className="visually-hidden"
          onChange={(event) => {
            const files = event.target.files
            if (files && files.length > 0) {
              void uploadFile(files[0])
            }
            event.target.value = ''
          }}
        />

        <div className="sidebar-list">
          {sessions.length === 0 ? (
            <div className="sidebar-empty">
              <DatabaseIcon size={18} />
              <p>No sources yet</p>
              <span>Add a CSV or Excel workbook above to start.</span>
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
