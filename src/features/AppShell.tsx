import { useState } from 'react'
import { ActivityIcon, MenuIcon, SettingsIcon } from './common/Icons'
import { ChatPanel } from './chat/ChatPanel'
import { SettingsModal } from './settings/SettingsModal'
import { ModelToggle } from './settings/ModelToggle'
import { SessionInfo } from './session/SessionInfo'
import { useSession } from './SessionProvider'
import { Sidebar } from './sidebar/Sidebar'
import { TracePanel } from './trace/TracePanel'
import { UploadZone } from './upload/UploadZone'

export function AppShell() {
  const { activeSession, traceOpen, toggleTrace, openSettings, traces } = useSession()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="app-shell">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      {sidebarOpen ? (
        <div
          className="sidebar-scrim"
          role="presentation"
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}

      <div className="app-body">
        <header className="topbar">
          <div className="topbar-left">
            <button
              type="button"
              className="btn-icon topbar-menu"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open sidebar"
            >
              <MenuIcon size={18} />
            </button>
            <SessionInfo />
          </div>
          <div className="topbar-right">
            <div className="topbar-model">
              <ModelToggle compact />
            </div>
            <button
              type="button"
              className={`btn-icon topbar-trace ${traceOpen ? 'is-active' : ''}`}
              onClick={toggleTrace}
              aria-label={traceOpen ? 'Close tool trace' : 'Open tool trace'}
              aria-pressed={traceOpen}
            >
              <ActivityIcon size={18} />
              {traces.length > 0 ? <span className="icon-badge">{traces.length}</span> : null}
            </button>
            <button
              type="button"
              className="btn-icon"
              onClick={openSettings}
              aria-label="Open settings"
            >
              <SettingsIcon size={18} />
            </button>
          </div>
        </header>

        <div className={`workspace ${traceOpen ? 'trace-open' : ''}`}>
          <main className="main-pane">
            {activeSession ? <ChatPanel /> : <UploadZone />}
          </main>
          <TracePanel />
        </div>
      </div>

      <SettingsModal />
    </div>
  )
}
