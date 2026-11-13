import { lazy, Suspense, useEffect, useState, type CSSProperties } from 'react'
import { useRouter } from '../core/router'
import { refreshUsage } from '../core/supabase/usage'
import {
  getPanelWidth,
  getSidebarWidth,
  PANEL_WIDTH,
  savePanelWidth,
  saveSidebarWidth,
  SIDEBAR_WIDTH,
} from '../core/storage/uiPrefs'
import { Panel } from './chat'
import { DatabaseIcon, SendIcon, SparklesIcon } from './common/Icons'
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
const SpreadsheetModal = lazy(() =>
  import('./spreadsheet/SpreadsheetModal').then((module) => ({
    default: module.SpreadsheetModal,
  })),
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
  const { query, path, navigate } = useRouter()
  const {
    activeSession,
    sidebarOpen,
    panelOpen,
    settingsOpen,
    reportOpen,
    sheetPicker,
    clearChatConfirmOpen,
    spreadsheetSource,
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
    closeSpreadsheet,
  } = useSessionActions()
  const sidebarOverlay = useMediaQuery(SIDEBAR_OVERLAY_QUERY)
  const panelOverlay = useMediaQuery(PANEL_OVERLAY_QUERY)
  const [mobilePane, setMobilePane] = useState<'sources' | 'chat' | 'studio'>('chat')

  // Refresh entitlement immediately after returning from Stripe Checkout
  useEffect(() => {
    const billing = query.get('billing')
    if (billing === 'success' || billing === 'canceled') {
      void refreshUsage()
      navigate(path, { replace: true })
    }
  }, [query, path, navigate])
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

  const sidebarInGrid = sidebarOpen && !panelOverlay
  const panelInGrid = panelOpen && !panelOverlay

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

  const gridClasses = [
    'app-grid',
    sidebarInGrid ? 'has-sidebar' : '',
    panelInGrid ? 'has-panel' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className="app-shell is-workspace-shell" style={layoutStyle}>
      <Header variant="workspace" />

      <div className={gridClasses}>
        {!panelOverlay ? (
          sidebarInGrid ? (
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
          ) : null
        ) : mobilePane === 'sources' ? (
          <Sidebar
            onClose={() => setMobilePane('chat')}
            onSelectSessionComplete={() => setMobilePane('chat')}
          />
        ) : null}

        {!panelOverlay || mobilePane === 'chat' ? (
          <div className="app-main">
            <main className="app-content">
              {activeSession ? <Panel /> : <UploadZone />}
            </main>
          </div>
        ) : null}

        {!panelOverlay ? (
          panelInGrid ? (
            <>
              <ResizeHandle
                side="right"
                label="Resize studio panel"
                width={panelWidth}
                min={PANEL_WIDTH.min}
                max={PANEL_WIDTH.max}
                onResize={updatePanelWidth}
              />
              <Inspector />
            </>
          ) : null
        ) : mobilePane === 'studio' ? (
          <Inspector onSwitchToChat={() => setMobilePane('chat')} />
        ) : null}
      </div>

      {panelOverlay ? (
        <nav className="workspace-mobile-nav" aria-label="Workspace panels">
          <div className="workspace-mobile-nav-track" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={mobilePane === 'sources'}
              className={`workspace-mobile-tab ${mobilePane === 'sources' ? 'is-active' : ''}`}
              onClick={() => setMobilePane('sources')}
            >
              <DatabaseIcon size={15} />
              <span>Sources</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mobilePane === 'chat'}
              className={`workspace-mobile-tab ${mobilePane === 'chat' ? 'is-active' : ''}`}
              onClick={() => setMobilePane('chat')}
            >
              <SendIcon size={15} />
              <span>Chat</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mobilePane === 'studio'}
              className={`workspace-mobile-tab ${mobilePane === 'studio' ? 'is-active' : ''}`}
              onClick={() => setMobilePane('studio')}
            >
              <SparklesIcon size={15} />
              <span>Studio</span>
            </button>
          </div>
        </nav>
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
      {spreadsheetSource ? (
        <Suspense fallback={null}>
          <SpreadsheetModal source={spreadsheetSource} onClose={closeSpreadsheet} />
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
