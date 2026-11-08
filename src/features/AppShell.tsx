import { useEffect, useState } from 'react'
import { ChatPanel } from './chat/ChatPanel'
import { Header } from './header/Header'
import { Inspector } from './panel/Inspector'
import { useSessionActions, useSessionState } from './SessionProvider'
import { SettingsModal } from './settings/SettingsModal'
import { Sidebar } from './sidebar/Sidebar'
import { UploadZone } from './upload/UploadZone'

/**
 * Application shell.
 *
 * Owns the three-region layout: sidebar, main column, inspector. The sidebar is
 * a persistent column at >= 1024px and an overlay drawer below that; the
 * inspector collapses to zero width when closed. Both states are remembered
 * across reloads by the provider.
 */

/** Below this width the sidebar becomes an overlay instead of a column. */
const OVERLAY_BREAKPOINT = 1024

export function AppShell() {
  const { activeSession, sidebarOpen, panelOpen } = useSessionState()
  const { setSidebarOpen } = useSessionActions()
  const [overlay, setOverlay] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < OVERLAY_BREAKPOINT,
  )

  useEffect(() => {
    const query = window.matchMedia(`(max-width: ${OVERLAY_BREAKPOINT - 1}px)`)
    const listener = (event: MediaQueryListEvent) => setOverlay(event.matches)
    setOverlay(query.matches)
    query.addEventListener('change', listener)
    return () => query.removeEventListener('change', listener)
  }, [])

  const sidebarAsOverlay = overlay && sidebarOpen

  return (
    <div className="app-shell">
      <div
        className={`app-grid ${sidebarOpen && !overlay ? 'has-sidebar' : ''} ${
          panelOpen ? 'has-panel' : ''
        }`}
      >
        {sidebarOpen && !overlay ? (
          <Sidebar onClose={() => setSidebarOpen(false)} />
        ) : null}

        <div className="app-main">
          <Header />
          <main className="app-content">
            {activeSession ? <ChatPanel /> : <UploadZone />}
          </main>
        </div>

        {panelOpen ? <Inspector /> : null}
      </div>

      {sidebarAsOverlay ? (
        <>
          <div
            className="scrim"
            role="presentation"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="sidebar-drawer">
            <Sidebar onClose={() => setSidebarOpen(false)} closable />
          </div>
        </>
      ) : null}

      <SettingsModal />
    </div>
  )
}
