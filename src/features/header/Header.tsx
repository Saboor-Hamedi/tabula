import { useEffect, useRef, useState } from 'react'
import { getModelOption, MODEL_OPTIONS } from '../../core/agent/modelOptions'
import {
  CheckIcon,
  CpuIcon,
  DownloadIcon,
  FileIcon,
  MoonIcon,
  PanelRightIcon,
  SunIcon,
} from '../common/Icons'
import { IconButton } from '../common/IconButton'
import { useOnline } from '../common/useOnline'
import { useTheme } from '../common/useTheme'
import { useSessionActions, useSessionState } from '../SessionProvider'

/**
 * Header.
 *
 * Left: active dataset name and status.
 * Right: report/export, model switcher, theme toggle, and the inspector toggle.
 */

export function Header() {
  const { activeSession, messages, model, panelOpen } = useSessionState()
  const {
    openPanel,
    closePanel,
    renameSession,
    exportTranscript,
    openReport,
  } = useSessionActions()
  const { theme, toggleTheme } = useTheme()
  const [editingName, setEditingName] = useState(false)
  const [draftName, setDraftName] = useState('')
  const online = useOnline()

  const canExport = messages.length > 0

  const beginRename = () => {
    if (!activeSession) return
    setDraftName(activeSession.fileName)
    setEditingName(true)
  }

  const commitRename = () => {
    if (activeSession && draftName.trim()) renameSession(activeSession.id, draftName)
    setEditingName(false)
  }

  return (
    <header className="app-header">
      <div className="app-header-left">
        <div className="header-title">
          {editingName ? (
            <input
              className="header-title-input"
              value={draftName}
              autoFocus
              aria-label="Dataset name"
              onChange={(event) => setDraftName(event.target.value)}
              onBlur={commitRename}
              onKeyDown={(event) => {
                if (event.key === 'Enter') commitRename()
                if (event.key === 'Escape') setEditingName(false)
              }}
            />
          ) : (
            <button
              type="button"
              className="header-title-name"
              title={activeSession ? 'Rename dataset' : undefined}
              onClick={beginRename}
            >
              {activeSession ? activeSession.fileName : 'New analysis'}
            </button>
          )}
          {activeSession ? (
            <span className="header-title-meta">
              {(activeSession.tables?.length ?? 0)} table
              {(activeSession.tables?.length ?? 0) === 1 ? '' : 's'}
            </span>
          ) : (
            <span className="header-title-meta">No dataset loaded</span>
          )}
        </div>
      </div>

      <div className="app-header-right">
        {!online ? <span className="offline-pill">Offline</span> : null}
        {activeSession ? (
          <>
            <IconButton label="Open report" disabled={!canExport} onClick={openReport}>
              <FileIcon size={16} />
            </IconButton>
            <IconButton
              label="Download conversation"
              disabled={!canExport}
              onClick={exportTranscript}
            >
              <DownloadIcon size={16} />
            </IconButton>
          </>
        ) : null}
        <ModelMenu model={model} />
        <IconButton
          label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          onClick={(e) => toggleTheme(e)}
        >
          {theme === 'dark' ? <SunIcon size={16} /> : <MoonIcon size={16} />}
        </IconButton>
        <IconButton
          label={panelOpen ? 'Hide inspector' : 'Show inspector'}
          active={panelOpen}
          onClick={() => (panelOpen ? closePanel() : openPanel('notes'))}
        >
          <PanelRightIcon size={17} />
        </IconButton>
      </div>
    </header>
  )
}

/**
 * Compact model switcher.
 *
 * Shows the current model only; the full list opens in a small menu. This keeps
 * the header short instead of carrying a permanent segmented control.
 */
function ModelMenu({ model }: { model: ReturnType<typeof getModelOption>['id'] }) {
  const { setModel } = useSessionActions()
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const current = getModelOption(model)

  useEffect(() => {
    if (!open) return

    const handlePointer = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', handlePointer)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handlePointer)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open])

  return (
    <div className="model-menu" ref={wrapperRef}>
      <button
        type="button"
        className={`model-trigger ${open ? 'is-open' : ''}`}
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <CpuIcon size={15} />
        <span>{current.shortLabel}</span>
      </button>

      {open ? (
        <div className="model-popover" role="listbox" aria-label="Model">
          {MODEL_OPTIONS.map((option) => {
            const selected = option.id === model
            return (
              <button
                key={option.id}
                type="button"
                role="option"
                aria-selected={selected}
                className={`model-option ${selected ? 'is-selected' : ''}`}
                onClick={() => {
                  setModel(option.id)
                  setOpen(false)
                }}
              >
                <div className="model-option-main">
                  <span className="model-option-name">{option.label}</span>
                  <span className="model-option-desc">{option.description}</span>
                </div>
                <div className="model-option-check" aria-hidden>
                  {selected ? <CheckIcon size={16} /> : null}
                </div>
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
