import { useEffect, useRef, useState } from 'react'
import { getModelOption, MODEL_OPTIONS } from '../../core/agent/modelOptions'
import { CheckIcon, CpuIcon, PanelRightIcon, SidebarIcon } from '../common/Icons'
import { IconButton } from '../common/IconButton'
import { useSessionActions, useSessionState } from '../SessionProvider'

/**
 * Header.
 *
 * Left: sidebar toggle and the active dataset name.
 * Right: the model switcher and the inspector toggle.
 *
 * The model switcher is the single place the model can be changed. Settings no
 * longer repeats it, so there is exactly one control per concern.
 */

export function Header() {
  const { activeSession, model, sidebarOpen, panelOpen } = useSessionState()
  const { toggleSidebar, openPanel, closePanel } = useSessionActions()

  return (
    <header className="app-header">
      <div className="app-header-left">
        <IconButton
          label={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
          active={sidebarOpen}
          onClick={toggleSidebar}
        >
          <SidebarIcon size={17} />
        </IconButton>

        <div className="header-title">
          <span className="header-title-name" title={activeSession?.fileName}>
            {activeSession ? activeSession.fileName : 'New analysis'}
          </span>
          {activeSession ? (
            <span className="header-title-meta">
              {activeSession.tables.length} table
              {activeSession.tables.length === 1 ? '' : 's'}
            </span>
          ) : (
            <span className="header-title-meta">No dataset loaded</span>
          )}
        </div>
      </div>

      <div className="app-header-right">
        <ModelMenu model={model} />
        <IconButton
          label={panelOpen ? 'Hide inspector' : 'Show inspector'}
          active={panelOpen}
          onClick={() => (panelOpen ? closePanel() : openPanel('file'))}
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
                <span className="model-option-main">
                  <span className="model-option-name">
                    {option.label}
                    {option.badge ? (
                      <span className="model-option-badge">{option.badge}</span>
                    ) : null}
                  </span>
                  <span className="model-option-desc">{option.description}</span>
                </span>
                {selected ? <CheckIcon size={15} /> : null}
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
