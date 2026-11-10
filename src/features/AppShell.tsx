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
import { useServiceWorkerUpdate } from './common/useServiceWorkerUpdate'
import { ConfirmModal } from './common/ConfirmModal'
import { Header } from './header/Header'
import { ResizeHandle } from './layout/ResizeHandle'
import { useSessionActions, useSessionState } from './SessionProvider'
import { Inspector } from './panel/Inspector'
import { Sidebar } from './sidebar/Sidebar'
import { SheetPicker } from './upload/SheetPicker'
import { UploadZone } from './upload/UploadZone'

const ReportView = lazy(() =>
  import('./report/ReportView').then((module) => ({ default: module.ReportView })),
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

export interface AppShellProps {
  isDemoMode?: boolean
}

export function AppShell({ isDemoMode = false }: AppShellProps) {
  const {
    activeSession,
    sessions,
    sidebarOpen,
    panelOpen,
    settingsOpen,
    reportOpen,
    sheetPicker,
    clearChatConfirmOpen,
  } = useSessionState()
  const {
    closePanel,
    openPanel,
    exportTranscript,
    setSidebarOpen,
    toggleSidebar,
    openSettings,
    cancelClearChat,
    confirmClearChat,
    uploadFile,
  } = useSessionActions()
  const sidebarOverlay = useMediaQuery(SIDEBAR_OVERLAY_QUERY)
  const panelOverlay = useMediaQuery(PANEL_OVERLAY_QUERY)

  // In demo mode: auto-load sample dataset if no session exists yet (Prompt 4.6)
  useEffect(() => {
    if (isDemoMode && !activeSession && sessions.length === 0) {
      void (async () => {
        try {
          const res = await fetch('/orders.csv')
          if (res.ok) {
            const blob = await res.blob()
            const file = new File([blob], 'orders.csv', { type: 'text/csv' })
            await uploadFile(file)
          }
        } catch {
          // Ignore demo load errors
        }
      })()
    }
  }, [isDemoMode, activeSession, sessions.length, uploadFile])
  useKeyboardShortcuts({
    exportTranscript,
    toggleSidebar,
    togglePanel: () => (panelOpen ? closePanel() : openPanel('notes')),
    openSettings,
  })
  const { updateReady, applyUpdate } = useServiceWorkerUpdate()

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
  const sidebarCollapsedInGrid = !sidebarOpen && !sidebarOverlay
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
        className={`app-grid ${
          sidebarInGrid
            ? 'has-sidebar'
            : sidebarCollapsedInGrid
            ? 'has-sidebar-collapsed'
            : ''
        } ${panelInGrid ? 'has-panel' : ''}`}
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
        ) : sidebarCollapsedInGrid ? (
          <Sidebar
            isCollapsed
            onClose={() => setSidebarOpen(false)}
            onExpand={() => setSidebarOpen(true)}
          />
        ) : null}

        <div className="app-main">
          {isDemoMode && (
            <div className="demo-mode-strip">
              <span className="demo-mode-pill">Interactive Demo</span>
              <span className="demo-mode-text">
                Exploring Tabula with sample orders dataset. Raw rows never leave your computer.
              </span>
              <button
                type="button"
                className="demo-mode-btn"
                onClick={() => {
                  window.location.hash = '#signup'
                }}
              >
                Create account to analyze your own files →
              </button>
            </div>
          )}
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

      {settingsOpen ? (
        <Suspense fallback={null}>
          <SettingsModal />
        </Suspense>
      ) : null}
      {reportOpen ? (
        <Suspense fallback={null}>
          <ReportView />
        </Suspense>
      ) : null}
      {sheetPicker ? <SheetPicker /> : null}
      <ConfirmModal
        open={clearChatConfirmOpen}
        title="Delete history"
        message="All contents will be deleted, are you sure?"
        confirmText="Confirm"
        cancelText="Cancel"
        onConfirm={() => void confirmClearChat()}
        onCancel={cancelClearChat}
      />
      {updateReady ? (
        <div className="update-toast" role="status">
          <span>A new version is ready.</span>
          <button type="button" className="btn btn-small btn-primary" onClick={applyUpdate}>
            Update
          </button>
        </div>
      ) : null}
    </div>
  )
}
