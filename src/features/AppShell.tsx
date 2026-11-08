import { lazy, Suspense, useEffect, useState, type CSSProperties } from 'react'
import {
  getPanelWidth,
  getSidebarWidth,
  PANEL_WIDTH,
  savePanelWidth,
  saveSidebarWidth,
  SIDEBAR_WIDTH,
} from '../core/storage/uiPrefs'
import { ChatPanel } from './chat/ChatPanel'
import { useKeyboardShortcuts } from './common/useKeyboardShortcuts'
import { Header } from './header/Header'
import { ResizeHandle } from './layout/ResizeHandle'
import { useSessionActions, useSessionState } from './SessionProvider'
import { Sidebar } from './sidebar/Sidebar'
import { UploadZone } from './upload/UploadZone'

const Inspector = lazy(() =>
  import('./panel/Inspector').then((module) => ({ default: module.Inspector })),
)
const SettingsModal = lazy(() =>
  import('./settings/SettingsModal').then((module) => ({ default: module.SettingsModal })),
)

/**
 * Application shell.
 *
 * Three columns share one row: datasets, the chat workspace, and the inspector.
 * Each side column is separated by a 5px draggable gutter. The sidebar becomes
 * an overlay at 800px; the inspector becomes a sheet at 1024px.
 */

const SIDEBAR_OVERLAY_QUERY = '(max-width: 800px)'
const PANEL_OVERLAY_QUERY = '(max-width: 1023px)'

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(query).matches,
  )

  useEffect(() => {
    const media = window.matchMedia(query)
    const listener = (event: MediaQueryListEvent) => setMatches(event.matches)
    media.addEventListener('change', listener)
    return () => media.removeEventListener('change', listener)
  }, [query])

  return matches
}

export function AppShell() {
  const { activeSession, sidebarOpen, panelOpen, settingsOpen } = useSessionState()
  const { closePanel, exportTranscript, setSidebarOpen } = useSessionActions()
  const sidebarOverlay = useMediaQuery(SIDEBAR_OVERLAY_QUERY)
  const panelOverlay = useMediaQuery(PANEL_OVERLAY_QUERY)
  useKeyboardShortcuts({ exportTranscript })

  const [sidebarWidth, setSidebarWidth] = useState(getSidebarWidth)
  const [panelWidth, setPanelWidth] = useState(getPanelWidth)

  // Start compact: the sidebar is an overlay on phones and should not cover the
  // chat until the user asks for it.
  useEffect(() => {
    if (sidebarOverlay) setSidebarOpen(false, false)
  }, [setSidebarOpen, sidebarOverlay])

  // The inspector becomes a sheet under 1024px; don't let it cover the chat on
  // first paint. The user can still open it from the header.
  useEffect(() => {
    if (panelOverlay) closePanel(false)
  }, [closePanel, panelOverlay])

  const sidebarInGrid = sidebarOpen && !sidebarOverlay
  const panelInGrid = panelOpen && !panelOverlay
  const sidebarAsOverlay = sidebarOpen && sidebarOverlay

  const updateSidebarWidth = (width: number) => {
    setSidebarWidth(width)
    saveSidebarWidth(width)
  }

  const updatePanelWidth = (width: number) => {
    setPanelWidth(width)
    savePanelWidth(width)
  }

  const layoutStyle = {
    '--sidebar-width': `${sidebarWidth}px`,
    '--inspector-width': `${panelWidth}px`,
  } as CSSProperties

  return (
    <div className="app-shell" style={layoutStyle}>
      <div
        className={`app-grid ${sidebarInGrid ? 'has-sidebar' : ''} ${
          panelInGrid ? 'has-panel' : ''
        }`}
      >
        {sidebarInGrid ? (
          <>
            <Sidebar onClose={() => setSidebarOpen(false)} />
            <ResizeHandle
              side="left"
              label="Resize datasets sidebar"
              width={sidebarWidth}
              min={SIDEBAR_WIDTH.min}
              max={SIDEBAR_WIDTH.max}
              onResize={updateSidebarWidth}
            />
          </>
        ) : null}

        <div className="app-main">
          <Header />
          <main className="app-content">
            {activeSession ? <ChatPanel /> : <UploadZone />}
          </main>
        </div>

        {panelInGrid ? (
          <ResizeHandle
            side="right"
            label="Resize inspector"
            width={panelWidth}
            min={PANEL_WIDTH.min}
            max={PANEL_WIDTH.max}
            onResize={updatePanelWidth}
          />
        ) : null}
        {panelOpen ? (
          <Suspense fallback={<aside className="inspector" aria-hidden />}>
            <Inspector />
          </Suspense>
        ) : null}
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

      {settingsOpen ? (
        <Suspense fallback={null}>
          <SettingsModal />
        </Suspense>
      ) : null}
    </div>
  )
}
