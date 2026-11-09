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
  const { sessions, activeSession, upload, messages, pythonResult } = useSessionState()
  const { selectSession, uploadFile } = useSessionActions()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [exportType, setExportType] = useState<'pdf' | 'doc' | 'txt' | null>(null)
  const [exportStatus, setExportStatus] = useState<string | null>(null)

  const handleExportPdf = async () => {
    if (!activeSession) return
    setMenuOpen(false)
    setExportType('pdf')
    setExportStatus('Preparing report layout…')
    try {
      await exportAnalysisAsPdf(activeSession, messages, pythonResult, (status) => {
        setExportStatus(status)
      })
      setExportStatus('PDF Downloaded')
      setTimeout(() => {
        setExportType(null)
        setExportStatus(null)
      }, 1600)
    } catch (err) {
      console.error(err)
      setExportStatus('Export failed')
      setTimeout(() => {
        setExportType(null)
        setExportStatus(null)
      }, 2000)
    }
  }

  const handleExportDoc = async () => {
    if (!activeSession) return
    setMenuOpen(false)
    setExportType('doc')
    setExportStatus('Formatting Word document…')
    try {
      await exportAnalysisAsDoc(activeSession, messages, pythonResult, (status) => {
        setExportStatus(status)
      })
      setExportStatus('Document Downloaded')
      setTimeout(() => {
        setExportType(null)
        setExportStatus(null)
      }, 1600)
    } catch (err) {
      console.error(err)
      setExportStatus('Export failed')
      setTimeout(() => {
        setExportType(null)
        setExportStatus(null)
      }, 2000)
    }
  }

  const handleExportText = () => {
    if (!activeSession) return
    setMenuOpen(false)
    setExportType('txt')
    setExportStatus('Generating text summary…')
    try {
      exportAnalysisAsText(activeSession, messages, pythonResult, (status) => {
        setExportStatus(status)
      })
      setExportStatus('Summary Downloaded')
      setTimeout(() => {
        setExportType(null)
        setExportStatus(null)
      }, 1600)
    } catch (err) {
      console.error(err)
      setExportType(null)
      setExportStatus(null)
    }
  }

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

      {/* Dedicated Export Dropdown Panel with Dynamic Loader */}
      {activeSession ? (
        <div className="sidebar-export-panel" ref={menuRef}>
          <button
            type="button"
            className={`sidebar-export-panel-btn ${menuOpen ? 'is-active' : ''} ${exportType ? 'is-exporting' : ''}`}
            onClick={() => {
              if (!exportType) setMenuOpen(!menuOpen)
            }}
            disabled={exportType !== null}
            aria-expanded={menuOpen}
            title={exportType ? (exportStatus ?? 'Exporting analysis…') : 'Export analysis reports'}
          >
            <span className="sidebar-export-panel-left">
              <span className="sidebar-export-panel-icon" aria-hidden>
                {exportType ? (
                  <span className="export-spinner" />
                ) : (
                  <DownloadIcon size={14} />
                )}
              </span>
              <span className="sidebar-export-panel-title">
                {exportType ? exportStatus : 'Export Analysis'}
              </span>
            </span>
            {!exportType && (
              <ChevronDownIcon size={12} className={menuOpen ? 'icon-rotated' : ''} />
            )}
          </button>

          {menuOpen && !exportType && (
            <div className="sidebar-dropdown-menu" role="menu">
              <div className="dropdown-menu-header">Export Analysis</div>
              <button
                type="button"
                className="dropdown-menu-item"
                role="menuitem"
                onClick={handleExportPdf}
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
                onClick={handleExportDoc}
              >
                <span className="dropdown-item-icon doc-icon">
                  <FileIcon size={13} />
                </span>
                <div className="dropdown-item-text">
                  <span className="dropdown-item-title">Export to Word (.docx)</span>
                  <span className="dropdown-item-hint">Formatted document with tables</span>
                </div>
              </button>
              <button
                type="button"
                className="dropdown-menu-item"
                role="menuitem"
                onClick={handleExportText}
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
