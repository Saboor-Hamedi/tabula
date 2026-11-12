import { createContext, useContext } from 'react'
import type {
  ChatMessage,
  DatasetDigest,
  ModelId,
  PanelTab,
  Session,
  SheetInfo,
  ToolTraceEntry,
  UploadState,
} from '../../core/types'
import type { FigureChanges } from '../../core/parsing/editFigure'
import type { PythonExecutionResult, PythonStatus } from '../../core/python'
import type { SpreadsheetSource } from '../spreadsheet/types'

export interface SheetPickerRequest {
  file: File
  fileName: string
  sheets: SheetInfo[]
}

export interface SessionState {
  dbReady: boolean
  dbError: string | null
  sessions: Session[]
  activeSession: Session | null
  messages: ChatMessage[]
  traces: ToolTraceEntry[]
  /** Live snapshot of the active dataset, used for suggestions and the digest UI. */
  digest: DatasetDigest | null
  isStreaming: boolean
  streamingSessionId: string | null
  upload: UploadState
  model: ModelId
  settingsOpen: boolean
  reportOpen: boolean
  panelOpen: boolean
  panelTab: PanelTab
  sidebarOpen: boolean
  sheetPicker: SheetPickerRequest | null
  pythonResult: PythonExecutionResult | null
  pythonHistory: PythonExecutionResult[]
  pythonStatus: PythonStatus
  clearChatConfirmOpen: boolean
  notesVersion: number
  spreadsheetSource: SpreadsheetSource | null
}

export interface SessionActions {
  uploadFile: (file: File) => Promise<void>
  selectSession: (sessionId: string) => void
  deleteSession: (sessionId: string) => Promise<void>
  sendMessage: (text: string) => Promise<void>
  stopStreaming: () => void
  openSettings: () => void
  closeSettings: () => void
  openReport: () => void
  closeReport: () => void
  setModel: (model: ModelId) => void
  openPanel: (tab?: PanelTab) => void
  closePanel: (persist?: boolean) => void
  setPanelTab: (tab: PanelTab) => void
  setSidebarOpen: (open: boolean, persist?: boolean) => void
  toggleSidebar: () => void
  exportTrace: () => void
  exportTranscript: () => void
  renameSession: (sessionId: string, fileName: string) => void
  replaceActiveFile: (file: File) => Promise<void>
  editFigure: (
    messageId: string,
    figureIndex: number,
    changes: FigureChanges,
  ) => void
  confirmSheetSelection: (sheetNames: string[]) => Promise<void>
  cancelSheetSelection: () => void
  /** Hands the original uploaded file to the OS so it opens in Excel. */
  openActiveFile: () => Promise<void>
  runPythonCode: (code: string, options?: { openPanel?: boolean }) => Promise<PythonExecutionResult>
  clearPythonResult: () => void
  removePythonRun: (index: number) => void
  saveToNotes: (text: string) => void
  requestClearChat: () => void
  cancelClearChat: () => void
  confirmClearChat: () => Promise<void>
  clearChat: () => Promise<void>
  openSpreadsheet: (source: SpreadsheetSource) => void
  closeSpreadsheet: () => void
}

export type SessionContextValue = SessionState & SessionActions

export const SessionStateContext = createContext<SessionState | null>(null)
export const SessionActionsContext = createContext<SessionActions | null>(null)

/** Full workspace access: state plus actions. */
export function useSession(): SessionContextValue {
  const state = useContext(SessionStateContext)
  const actions = useContext(SessionActionsContext)
  if (!state || !actions) {
    throw new Error('useSession must be used inside SessionProvider.')
  }
  return { ...state, ...actions }
}

/** State only. Use when a component must re-render on data changes. */
export function useSessionState(): SessionState {
  const state = useContext(SessionStateContext)
  if (!state) {
    throw new Error('useSessionState must be used inside SessionProvider.')
  }
  return state
}

/** Actions only. Use in buttons and forms to avoid streaming re-renders. */
export function useSessionActions(): SessionActions {
  const actions = useContext(SessionActionsContext)
  if (!actions) {
    throw new Error('useSessionActions must be used inside SessionProvider.')
  }
  return actions
}
