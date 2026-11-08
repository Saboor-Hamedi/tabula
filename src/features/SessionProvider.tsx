import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { DuckDBHandle } from '../core/duckdb/initDuckDB'
import { initDuckDB } from '../core/duckdb/initDuckDB'
import { closeDuckDB } from '../core/duckdb/closeDuckDB'
import { ingestCSV } from '../core/duckdb/ingestCSV'
import { ingestExcel } from '../core/duckdb/ingestExcel'
import { buildSchemaName, quoteIdent } from '../core/duckdb/sql'
import { buildDatasetDigest } from '../core/profiling/buildDigest'
import { buildLocalSuggestions, generateSuggestions } from '../core/agent/suggestions'
import { runAgentTurn } from '../core/agent/runAgentTurn'
import { buildTraceExport, traceExportFileName } from '../core/agent/trace'
import {
  clearApiKey as persistClearApiKey,
  getStoredApiKey,
  getStoredModel,
  saveApiKey as persistApiKey,
  saveModel as persistModel,
} from '../core/storage/settings'
import {
  clearSessionRegistry,
  registerSession,
  unregisterSession,
} from '../core/storage/sessions'
import {
  clearPersistedWorkspace,
  deletePersistedSession,
  loadPersistedWorkspace,
  loadSessionFile,
  saveActiveSessionId,
  savePersistedSession,
  saveSessionFile,
} from '../core/storage/persistence'
import { getPanelOpen, getSidebarOpen, savePanelOpen, saveSidebarOpen } from '../core/storage/uiPrefs'
import { downloadFile } from '../core/storage/fileAccess'
import { ACCEPTED_EXTENSIONS, MAX_UPLOAD_BYTES } from '../core/constants'
import { formatCount } from '../core/utils/format'
import type {
  ChatMessage,
  DatasetDigest,
  FileKind,
  ModelId,
  PanelTab,
  Session,
  ToolTraceEntry,
  UploadState,
} from '../core/types'

/**
 * Workspace state container.
 *
 * Responsibilities:
 *  - own the DuckDB handle and rebuild every persisted session on boot,
 *  - ingest uploads and keep a live dataset digest for the agent,
 *  - run agent turns and stream deltas into the active transcript,
 *  - generate data-derived follow-up suggestions after every answer,
 *  - persist transcripts and layout so a refresh loses nothing.
 *
 * Actions are exposed through a separate context so components that only need
 * to *do* things (buttons, composer) do not re-render on every streamed token.
 */

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
  apiKey: string | null
  model: ModelId
  settingsOpen: boolean
  panelOpen: boolean
  panelTab: PanelTab
  sidebarOpen: boolean
}

export interface SessionActions {
  uploadFile: (file: File) => Promise<void>
  selectSession: (sessionId: string) => void
  deleteSession: (sessionId: string) => Promise<void>
  sendMessage: (text: string) => Promise<void>
  stopStreaming: () => void
  openSettings: () => void
  closeSettings: () => void
  saveApiKey: (key: string) => void
  clearApiKey: () => void
  setModel: (model: ModelId) => void
  openPanel: (tab?: PanelTab) => void
  closePanel: () => void
  setPanelTab: (tab: PanelTab) => void
  setSidebarOpen: (open: boolean) => void
  toggleSidebar: () => void
  exportTrace: () => void
  /** Hands the original uploaded file to the OS so it opens in Excel. */
  openActiveFile: () => Promise<void>
}

export type SessionContextValue = SessionState & SessionActions

const SessionStateContext = createContext<SessionState | null>(null)
const SessionActionsContext = createContext<SessionActions | null>(null)

const IDLE_UPLOAD: UploadState = { phase: 'idle', fileName: null, message: '' }

function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`
}

function getFileKind(fileName: string): FileKind | null {
  const lower = fileName.toLowerCase()
  if (lower.endsWith('.csv')) return 'csv'
  if (lower.endsWith('.xlsx')) return 'xlsx'
  return null
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return 'Something went wrong.'
}

/** Restores fields missing from sessions saved by an earlier app version. */
function normalizeSession(session: Session): Session {
  return { ...session, fileSize: session.fileSize ?? 0 }
}

/** Clears transient suggestion flags so a reload never shows a stuck spinner. */
function normalizeMessages(messages: ChatMessage[]): ChatMessage[] {
  return messages.map((message) =>
    message.suggestionsPending ? { ...message, suggestionsPending: false } : message,
  )
}

function buildWelcomeMessage(session: Session, suggestions: string[]): ChatMessage {
  const tableLines = session.tables
    .map(
      (table) =>
        `- \`${table.name}\` — ${formatCount(table.rowCount)} rows · ${table.columnCount} columns`,
    )
    .join('\n')

  return {
    id: createId(),
    role: 'assistant',
    createdAt: Date.now(),
    welcome: true,
    suggestions,
    suggestionsPending: false,
    content: `**${session.fileName} is ready.**

Loaded ${session.tables.length} table${session.tables.length === 1 ? '' : 's'} into DuckDB:

${tableLines}

Ask anything, or start from one of the questions below. I read the actual columns and values before answering.`,
  }
}

interface BootstrapResult {
  handle: DuckDBHandle
  sessions: Session[]
  messagesBySession: Record<string, ChatMessage[]>
  tracesBySession: Record<string, ToolTraceEntry[]>
  digestBySession: Record<string, DatasetDigest>
  activeSessionId: string | null
}

/**
 * Opens DuckDB and rebuilds every persisted session from its stored file.
 *
 * Each restored session also gets a fresh digest, so the agent and the file
 * panel have full column context immediately after a refresh — not only after a
 * new upload.
 */
async function bootstrapWorkspace(): Promise<BootstrapResult> {
  const handle = await initDuckDB()
  const persisted = await loadPersistedWorkspace()
  const sessions: Session[] = []
  const messagesBySession: Record<string, ChatMessage[]> = {}
  const tracesBySession: Record<string, ToolTraceEntry[]> = {}
  const digestBySession: Record<string, DatasetDigest> = {}

  for (const record of persisted.sessions) {
    const session = normalizeSession(record.session)
    sessions.push(session)
    messagesBySession[session.id] = normalizeMessages(record.messages ?? [])
    tracesBySession[session.id] = record.traces ?? []
    registerSession(session)

    const file = await loadSessionFile(session.id)
    if (!file) continue

    try {
      if (session.fileType === 'csv') {
        await ingestCSV({ handle, file, sessionId: session.id })
      } else {
        await ingestExcel({ handle, file, sessionId: session.id })
      }

      digestBySession[session.id] = await buildDatasetDigest(handle.connection, session)

      // Recompute starter questions from the current digest. They are local and
      // deterministic, so a restored session always reflects the current
      // heuristics instead of whatever was stored days ago.
      messagesBySession[session.id] = messagesBySession[session.id].map((message) =>
        message.welcome
          ? {
              ...message,
              suggestions: buildLocalSuggestions(session, digestBySession[session.id]),
              suggestionsPending: false,
            }
          : message,
      )
    } catch {
      // Keep the transcript visible even if a stored file can no longer be parsed.
    }
  }

  return {
    handle,
    sessions,
    messagesBySession,
    tracesBySession,
    digestBySession,
    activeSessionId: persisted.activeSessionId,
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [dbReady, setDbReady] = useState(false)
  const [dbError, setDbError] = useState<string | null>(null)
  const [sessions, setSessions] = useState<Session[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [messagesBySession, setMessagesBySession] = useState<Record<string, ChatMessage[]>>({})
  const [tracesBySession, setTracesBySession] = useState<Record<string, ToolTraceEntry[]>>({})
  const [digestBySession, setDigestBySession] = useState<Record<string, DatasetDigest>>({})
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingSessionId, setStreamingSessionId] = useState<string | null>(null)
  const [upload, setUpload] = useState<UploadState>(IDLE_UPLOAD)
  const [apiKey, setApiKey] = useState<string | null>(() => getStoredApiKey())
  const [model, setModelState] = useState<ModelId>(() => getStoredModel())
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [panelOpen, setPanelOpenState] = useState(() => getPanelOpen(true))
  const [panelTab, setPanelTabState] = useState<PanelTab>('file')
  const [sidebarOpen, setSidebarOpenState] = useState(() => getSidebarOpen(true))

  const dbHandleRef = useRef<DuckDBHandle | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const streamingSessionRef = useRef<string | null>(null)
  const persistReadyRef = useRef(false)
  const bootstrapRef = useRef<Promise<BootstrapResult> | null>(null)
  /** Original files kept in memory so "Open in Excel" never re-reads storage. */
  const fileCacheRef = useRef<Map<string, File>>(new Map())

  useEffect(() => {
    let active = true
    if (!bootstrapRef.current) bootstrapRef.current = bootstrapWorkspace()

    bootstrapRef.current
      .then((result) => {
        if (!active) return
        dbHandleRef.current = result.handle
        setSessions(result.sessions)
        setMessagesBySession(result.messagesBySession)
        setTracesBySession(result.tracesBySession)
        setDigestBySession(result.digestBySession)
        setActiveSessionId(result.activeSessionId)
        setDbReady(true)
        setDbError(null)
        persistReadyRef.current = true
      })
      .catch((error: unknown) => {
        if (!active) return
        setDbError(errorMessage(error))
      })

    return () => {
      active = false
    }
  }, [])

  const activeSession = useMemo(
    () => sessions.find((session) => session.id === activeSessionId) ?? null,
    [sessions, activeSessionId],
  )

  const messages = useMemo(
    () => (activeSessionId ? messagesBySession[activeSessionId] ?? [] : []),
    [activeSessionId, messagesBySession],
  )

  const traces = useMemo(
    () => (activeSessionId ? tracesBySession[activeSessionId] ?? [] : []),
    [activeSessionId, tracesBySession],
  )

  const digest = useMemo(
    () => (activeSessionId ? digestBySession[activeSessionId] ?? null : null),
    [activeSessionId, digestBySession],
  )

  const upsertTrace = useCallback((sessionId: string, entry: ToolTraceEntry) => {
    setTracesBySession((previous) => {
      const list = previous[sessionId] ?? []
      const existingIndex = list.findIndex((item) => item.id === entry.id)
      const nextList =
        existingIndex >= 0
          ? list.map((item, index) => (index === existingIndex ? entry : item))
          : [...list, entry]
      return { ...previous, [sessionId]: nextList }
    })
  }, [])

  const patchMessage = useCallback(
    (sessionId: string, messageId: string, patch: Partial<ChatMessage>) => {
      setMessagesBySession((previous) => {
        const list = previous[sessionId]
        if (!list) return previous
        return {
          ...previous,
          [sessionId]: list.map((message) =>
            message.id === messageId ? { ...message, ...patch } : message,
          ),
        }
      })
    },
    [],
  )

  /** Builds a digest for a session and stores it for the agent and the UI. */
  const refreshDigest = useCallback(async (session: Session): Promise<DatasetDigest | null> => {
    const handle = dbHandleRef.current
    if (!handle) return null

    try {
      const next = await buildDatasetDigest(handle.connection, session)
      setDigestBySession((previous) => ({ ...previous, [session.id]: next }))
      return next
    } catch {
      return null
    }
  }, [])

  /**
   * Suggestion pass. Local heuristics land immediately (so the UI never waits),
   * then the model refines them when a key is configured.
   */
  const refreshSuggestions = useCallback(
    async (
      session: Session,
      messageId: string,
      currentDigest: DatasetDigest | null,
      question?: string,
      answer?: string,
    ): Promise<void> => {
      const local = buildLocalSuggestions(session, currentDigest)
      patchMessage(session.id, messageId, { suggestions: local, suggestionsPending: true })

      if (!apiKey) {
        patchMessage(session.id, messageId, { suggestionsPending: false })
        return
      }

      const refined = await generateSuggestions({
        session,
        digest: currentDigest,
        apiKey,
        model,
        question,
        answer,
      })
      patchMessage(session.id, messageId, {
        suggestions: refined,
        suggestionsPending: false,
      })
    },
    [apiKey, model, patchMessage],
  )

  const uploadFile = useCallback(
    async (file: File) => {
      const kind = getFileKind(file.name)
      if (!kind) {
        setUpload({
          phase: 'error',
          fileName: file.name,
          message: `Unsupported file type. Upload ${ACCEPTED_EXTENSIONS.join(' or ')}.`,
        })
        return
      }

      if (file.size > MAX_UPLOAD_BYTES) {
        setUpload({
          phase: 'error',
          fileName: file.name,
          message: 'File is too large for in-browser analysis (limit: 80 MB).',
        })
        return
      }

      setUpload({ phase: 'reading', fileName: file.name, message: 'Reading file…' })

      try {
        let handle = dbHandleRef.current
        if (!handle) {
          handle = await initDuckDB()
          dbHandleRef.current = handle
          setDbReady(true)
          setDbError(null)
        }

        setUpload({ phase: 'ingesting', fileName: file.name, message: 'Building DuckDB tables…' })

        const sessionId = createId()
        const result =
          kind === 'csv'
            ? await ingestCSV({ handle, file, sessionId })
            : await ingestExcel({ handle, file, sessionId })

        if (result.tables.length === 0) {
          throw new Error('No readable tables were found in this file.')
        }

        const session: Session = {
          id: sessionId,
          fileName: file.name,
          fileType: kind,
          fileSize: file.size,
          uploadedAt: Date.now(),
          schemaName: buildSchemaName(sessionId),
          tables: result.tables,
          primaryTable: result.primaryTable,
        }

        fileCacheRef.current.set(sessionId, file)
        registerSession(session)

        // Digest first: the welcome message and every suggestion depend on it.
        setUpload({ phase: 'ingesting', fileName: file.name, message: 'Profiling columns…' })
        const nextDigest = await refreshDigest(session)

        const welcome = buildWelcomeMessage(
          session,
          buildLocalSuggestions(session, nextDigest),
        )

        setSessions((previous) => [session, ...previous])
        setActiveSessionId(sessionId)
        setMessagesBySession((previous) => ({ ...previous, [sessionId]: [welcome] }))
        setTracesBySession((previous) => ({ ...previous, [sessionId]: [] }))
        setUpload({
          phase: 'done',
          fileName: file.name,
          message: `Loaded ${result.tables.length} table${result.tables.length === 1 ? '' : 's'}.`,
        })

        await saveSessionFile(sessionId, file)
        void savePersistedSession({
          id: sessionId,
          session,
          messages: [welcome],
          traces: [],
          updatedAt: Date.now(),
        })

        // Now let the model sharpen the starter questions.
        void refreshSuggestions(session, welcome.id, nextDigest)
      } catch (error) {
        setUpload({
          phase: 'error',
          fileName: file.name,
          message: errorMessage(error),
        })
      }
    },
    [refreshDigest, refreshSuggestions],
  )

  const selectSession = useCallback((sessionId: string) => {
    setActiveSessionId(sessionId)
    void saveActiveSessionId(sessionId)
  }, [])

  const deleteSession = useCallback(
    async (sessionId: string) => {
      if (streamingSessionRef.current === sessionId) {
        abortRef.current?.abort()
        abortRef.current = null
      }

      const target = sessions.find((session) => session.id === sessionId) ?? null
      const remaining = sessions.filter((session) => session.id !== sessionId)

      unregisterSession(sessionId)
      fileCacheRef.current.delete(sessionId)
      void deletePersistedSession(sessionId)

      setMessagesBySession((previous) => {
        const next = { ...previous }
        delete next[sessionId]
        return next
      })
      setTracesBySession((previous) => {
        const next = { ...previous }
        delete next[sessionId]
        return next
      })
      setDigestBySession((previous) => {
        const next = { ...previous }
        delete next[sessionId]
        return next
      })

      if (target && dbHandleRef.current) {
        try {
          await dbHandleRef.current.connection.query(
            `DROP SCHEMA IF EXISTS ${quoteIdent(target.schemaName)} CASCADE`,
          )
        } catch {
          // The schema may already be gone, or the DB may be shutting down.
        }
      }

      if (remaining.length === 0) {
        clearSessionRegistry()
        setSessions([])
        setActiveSessionId(null)
        setMessagesBySession({})
        setTracesBySession({})
        setDigestBySession({})
        setIsStreaming(false)
        setStreamingSessionId(null)
        streamingSessionRef.current = null
        setPanelOpenState(false)
        dbHandleRef.current = null
        setDbReady(false)
        void clearPersistedWorkspace()
        await closeDuckDB()
        return
      }

      const nextActiveId = activeSessionId === sessionId ? remaining[0].id : activeSessionId
      setSessions(remaining)
      setActiveSessionId(nextActiveId)
      if (nextActiveId) void saveActiveSessionId(nextActiveId)
    },
    [activeSessionId, sessions],
  )

  const sendMessage = useCallback(
    async (rawText: string) => {
      const text = rawText.trim()
      if (text.length === 0) return

      const session = activeSession
      if (!session) return

      if (!apiKey) {
        setSettingsOpen(true)
        return
      }

      if (isStreaming || !dbHandleRef.current) return

      const sessionId = session.id
      const history = messagesBySession[sessionId] ?? []
      const userMessage: ChatMessage = {
        id: createId(),
        role: 'user',
        content: text,
        createdAt: Date.now(),
      }
      const assistantId = createId()
      const assistantMessage: ChatMessage = {
        id: assistantId,
        role: 'assistant',
        content: '',
        createdAt: Date.now(),
      }

      setMessagesBySession((previous) => ({
        ...previous,
        [sessionId]: [...(previous[sessionId] ?? []), userMessage, assistantMessage],
      }))
      setIsStreaming(true)
      setStreamingSessionId(sessionId)
      streamingSessionRef.current = sessionId

      const controller = new AbortController()
      abortRef.current = controller

      try {
        const result = await runAgentTurn({
          apiKey,
          model,
          session,
          digest: digestBySession[sessionId] ?? null,
          history,
          userText: text,
          signal: controller.signal,
          onDelta: (delta) => {
            setMessagesBySession((previous) => {
              const list = previous[sessionId] ?? []
              return {
                ...previous,
                [sessionId]: list.map((message) =>
                  message.id === assistantId
                    ? { ...message, content: message.content + delta }
                    : message,
                ),
              }
            })
          },
          onTrace: (entry) => upsertTrace(sessionId, entry),
        })

        patchMessage(sessionId, assistantId, { content: result.text })

        // Follow-ups are derived from the question, the answer, and the data.
        void refreshSuggestions(
          session,
          assistantId,
          digestBySession[sessionId] ?? null,
          text,
          result.text,
        )
      } catch (error) {
        if (controller.signal.aborted) {
          setMessagesBySession((previous) => {
            const list = previous[sessionId] ?? []
            return {
              ...previous,
              [sessionId]: list.map((message) =>
                message.id === assistantId
                  ? {
                      ...message,
                      suggestionsPending: false,
                      content:
                        message.content.trim().length > 0
                          ? `${message.content}\n\n_Stopped._`
                          : '_Generation stopped._',
                    }
                  : message,
              ),
            }
          })
        } else {
          const message = errorMessage(error)
          setMessagesBySession((previous) => {
            const list = previous[sessionId] ?? []
            return {
              ...previous,
              [sessionId]: list.map((item) =>
                item.id === assistantId
                  ? {
                      ...item,
                      error: true,
                      suggestionsPending: false,
                      content:
                        item.content.trim().length > 0
                          ? `${item.content}\n\n> **Agent error:** ${message}`
                          : `> **Agent error:** ${message}`,
                    }
                  : item,
              ),
            }
          })
        }
      } finally {
        setIsStreaming(false)
        setStreamingSessionId(null)
        streamingSessionRef.current = null
        abortRef.current = null
      }
    },
    [
      activeSession,
      apiKey,
      digestBySession,
      isStreaming,
      messagesBySession,
      model,
      patchMessage,
      refreshSuggestions,
      upsertTrace,
    ],
  )

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  const openSettings = useCallback(() => setSettingsOpen(true), [])
  const closeSettings = useCallback(() => setSettingsOpen(false), [])

  const saveApiKey = useCallback((key: string) => {
    const trimmed = key.trim()
    persistApiKey(trimmed)
    setApiKey(trimmed.length > 0 ? trimmed : null)
  }, [])

  const clearApiKey = useCallback(() => {
    persistClearApiKey()
    setApiKey(null)
  }, [])

  const setModel = useCallback((nextModel: ModelId) => {
    persistModel(nextModel)
    setModelState(nextModel)
  }, [])

  const openPanel = useCallback((tab: PanelTab = 'file') => {
    setPanelTabState(tab)
    setPanelOpenState(true)
    savePanelOpen(true)
  }, [])

  const closePanel = useCallback(() => {
    setPanelOpenState(false)
    savePanelOpen(false)
  }, [])

  const setPanelTab = useCallback((tab: PanelTab) => {
    setPanelTabState(tab)
    setPanelOpenState(true)
    savePanelOpen(true)
  }, [])

  const setSidebarOpen = useCallback((open: boolean) => {
    setSidebarOpenState(open)
    saveSidebarOpen(open)
  }, [])

  const toggleSidebar = useCallback(() => {
    setSidebarOpenState((previous) => {
      saveSidebarOpen(!previous)
      return !previous
    })
  }, [])

  const exportTrace = useCallback(() => {
    const session = activeSession
    if (!session) return
    const sessionTraces = tracesBySession[session.id] ?? []
    const blob = new Blob([buildTraceExport(session, sessionTraces)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = traceExportFileName(session)
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
  }, [activeSession, tracesBySession])

  /**
   * Hands the original file back to the OS.
   *
   * A browser cannot spawn Excel, but it can download the exact bytes it was
   * given; the OS then opens the file with the registered spreadsheet app.
   */
  const openActiveFile = useCallback(async () => {
    const session = activeSession
    if (!session) return

    const cached = fileCacheRef.current.get(session.id)
    if (cached) {
      downloadFile(cached)
      return
    }

    const stored = await loadSessionFile(session.id)
    if (!stored) return
    fileCacheRef.current.set(session.id, stored)
    downloadFile(stored)
  }, [activeSession])

  // Debounced snapshots keep transcripts and results intact across refreshes.
  useEffect(() => {
    if (!persistReadyRef.current || isStreaming) return
    const timer = window.setTimeout(() => {
      for (const session of sessions) {
        void savePersistedSession({
          id: session.id,
          session,
          messages: messagesBySession[session.id] ?? [],
          traces: tracesBySession[session.id] ?? [],
          updatedAt: Date.now(),
        })
      }
    }, 350)
    return () => window.clearTimeout(timer)
  }, [isStreaming, messagesBySession, sessions, tracesBySession])

  useEffect(() => {
    if (!persistReadyRef.current) return
    void saveActiveSessionId(activeSessionId)
  }, [activeSessionId])

  const state = useMemo<SessionState>(
    () => ({
      dbReady,
      dbError,
      sessions,
      activeSession,
      messages,
      traces,
      digest,
      isStreaming,
      streamingSessionId,
      upload,
      apiKey,
      model,
      settingsOpen,
      panelOpen,
      panelTab,
      sidebarOpen,
    }),
    [
      activeSession,
      apiKey,
      dbError,
      dbReady,
      digest,
      isStreaming,
      messages,
      model,
      panelOpen,
      panelTab,
      sessions,
      settingsOpen,
      sidebarOpen,
      streamingSessionId,
      traces,
      upload,
    ],
  )

  // Stable for the lifetime of the provider: action-only consumers never re-render.
  const actions = useMemo<SessionActions>(
    () => ({
      uploadFile,
      selectSession,
      deleteSession,
      sendMessage,
      stopStreaming,
      openSettings,
      closeSettings,
      saveApiKey,
      clearApiKey,
      setModel,
      openPanel,
      closePanel,
      setPanelTab,
      setSidebarOpen,
      toggleSidebar,
      exportTrace,
      openActiveFile,
    }),
    [
      clearApiKey,
      closePanel,
      closeSettings,
      deleteSession,
      exportTrace,
      openActiveFile,
      openPanel,
      openSettings,
      saveApiKey,
      selectSession,
      sendMessage,
      setModel,
      setPanelTab,
      setSidebarOpen,
      stopStreaming,
      toggleSidebar,
      uploadFile,
    ],
  )

  return (
    <SessionActionsContext.Provider value={actions}>
      <SessionStateContext.Provider value={state}>{children}</SessionStateContext.Provider>
    </SessionActionsContext.Provider>
  )
}

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
  if (!state) throw new Error('useSessionState must be used inside SessionProvider.')
  return state
}

/** Actions only. Use in buttons and forms to avoid streaming re-renders. */
export function useSessionActions(): SessionActions {
  const actions = useContext(SessionActionsContext)
  if (!actions) throw new Error('useSessionActions must be used inside SessionProvider.')
  return actions
}
