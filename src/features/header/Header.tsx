import {
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

/**
 * Header.
 *
 * Left: App branding and sovereign privacy badge.
 * Right: Tour & pricing, clear chat history, theme toggle, and the inspector toggle.
 */

export function Header() {
  const { activeSession, messages, panelOpen } = useSessionState()
  const {
    openPanel,
    closePanel,
    clearChat,
  } = useSessionActions()
  const { theme, toggleTheme } = useTheme()
  const online = useOnline()

  return (
    <header className="app-header">
      <div className="app-header-left">
        <div className="header-brand-title">
          <span className="header-brand-name">Tabula</span>
          <span
            className="header-security-compact"
            title="100% Private In-Memory Sandbox: Zero server uploads. Data never leaves your device."
          >
            <ShieldCheckIcon size={12} />
            <span className="header-security-compact-text">100% Private Sandbox</span>
          </span>
        </div>
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
