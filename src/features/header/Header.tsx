import { useState } from 'react'
import {
  FileIcon,
  MoonIcon,
  PanelRightIcon,
  ShieldCheckIcon,
  SunIcon,
  TrashIcon,
} from '../common/Icons'
import { IconButton } from '../common/IconButton'
import { useOnline } from '../common/useOnline'
import { useTheme } from '../common/useTheme'
import { useSessionActions, useSessionState } from '../SessionProvider'
import { useAuth } from '../auth/useAuth'
import { AuthModal } from '../auth/AuthModal'

/**
 * Header.
 *
 * Left: active dataset name and status.
 * Right: account/auth, report, clear chat history, theme toggle, and the inspector toggle.
 */

export function Header() {
  const { activeSession, messages, panelOpen } = useSessionState()
  const {
    openPanel,
    closePanel,
    renameSession,
    openReport,
    clearChat,
  } = useSessionActions()
  const { theme, toggleTheme } = useTheme()
  const { user, profile, isPro, isConfigured } = useAuth()
  const [authModalOpen, setAuthModalOpen] = useState(false)
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
              Loaded {(activeSession.tables?.length ?? 0)} table
              {(activeSession.tables?.length ?? 0) === 1 ? '' : 's'}.
            </span>
          ) : (
            <span className="header-title-meta">No dataset loaded</span>
          )}
        </div>
      </div>

      {/* Center Sovereign Security Badge */}
      <div
        className="header-security-pill"
        title="Zero data uploaded. All calculations run exclusively in local memory."
      >
        <ShieldCheckIcon size={13} />
        <span className="security-pill-label">In-Memory Sandbox</span>
        <span className="security-pill-dot" />
        <span className="security-pill-safe">Zero Server Uploads</span>
      </div>

      <div className="app-header-right">
        {!online ? <span className="offline-pill">Offline</span> : null}
        <button
          type="button"
          className="header-tour-link"
          onClick={() => {
            window.location.hash = '#landing'
          }}
          title="Product Tour & Pricing Plans"
        >
          Tour & Pricing
        </button>
        {isConfigured ? (
          user ? (
            <button
              type="button"
              className="header-account-btn"
              onClick={() => setAuthModalOpen(true)}
              title={`Account (${isPro ? 'Pro' : 'Free'})`}
            >
              <span className="header-account-avatar">
                {profile?.display_name
                  ? profile.display_name.charAt(0).toUpperCase()
                  : user.email?.charAt(0).toUpperCase() || 'U'}
              </span>
              <span className={`header-account-badge ${isPro ? 'is-pro' : 'is-free'}`}>
                {isPro ? 'PRO' : 'FREE'}
              </span>
            </button>
          ) : (
            <button
              type="button"
              className="header-signin-btn"
              onClick={() => setAuthModalOpen(true)}
            >
              Sign in
            </button>
          )
        ) : null}
        {activeSession && messages.length > 0 ? (
          <IconButton
            label="Clear chat history"
            onClick={() => {
              if (window.confirm('Clear all chat messages and reset conversation?')) {
                void clearChat()
              }
            }}
          >
            <TrashIcon size={16} />
          </IconButton>
        ) : null}
        {activeSession ? (
          <IconButton label="Open report" disabled={!canExport} onClick={openReport}>
            <FileIcon size={16} />
          </IconButton>
        ) : null}
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

      <AuthModal open={authModalOpen} onClose={() => setAuthModalOpen(false)} />
    </header>
  )
}
