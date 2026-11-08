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
import { ACCEPTED_EXTENSIONS, MAX_UPLOAD_BYTES } from '../core/constants'
import { formatCount } from '../core/utils/format'
import type {
  ChatMessage,
  FileKind,
  ModelId,
  Session,
  ToolTraceEntry,
  UploadState,
} from '../core/types'

export interface SessionContextValue {
  dbReady: boolean
  dbError: string | null
  sessions: Session[]
  activeSession: Session | null
  messages: ChatMessage[]
  traces: ToolTraceEntry[]
  isStreaming: boolean
  streamingSessionId: string | null
  upload: UploadState
  apiKey: string | null
  model: ModelId
  settingsOpen: boolean
  traceOpen: boolean
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
  toggleTrace: () => void
  setTraceOpen: (open: boolean) => void
  exportTrace: () => void
}

const SessionContext = createContext<SessionContextValue | null>(null)

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

function buildWelcomeMessage(session: Session): ChatMessage {
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
    content: `**${session.fileName} is ready.**

Loaded ${session.tables.length} table${session.tables.length === 1 ? '' : 's'} into DuckDB:

${tableLines}

Ask anything about this data. I will inspect the schema, explore it with SQL, and answer with charts and tables.`,
  }
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return 'Something went wrong.'
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [dbReady, setDbReady] = useState(false)
  const [dbError, setDbError] = useState<string | null>(null)
  const [sessions, setSessions] = useState<Session[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [messagesBySession, setMessagesBySession] = useState<Record<string, ChatMessage[]>>({})
  const [tracesBySession, setTracesBySession] = useState<Record<string, ToolTraceEntry[]>>({})
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingSessionId, setStreamingSessionId] = useState<string | null>(null)
  const [upload, setUpload] = useState<UploadState>(IDLE_UPLOAD)
  const [apiKey, setApiKey] = useState<string | null>(() => getStoredApiKey())
  const [model, setModelState] = useState<ModelId>(() => getStoredModel())
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [traceOpen, setTraceOpen] = useState(false)

  const dbHandleRef = useRef<DuckDBHandle | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const streamingSessionRef = useRef<string | null>(null)

  useEffect(() => {
    let cancelled = false
    initDuckDB()
      .then((handle) => {
        if (cancelled) return
        dbHandleRef.current = handle
        setDbReady(true)
        setDbError(null)
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setDbError(errorMessage(error))
      })
    return () => {
      cancelled = true
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

  const uploadFile = useCallback(async (file: File) => {
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
        uploadedAt: Date.now(),
        schemaName: buildSchemaName(sessionId),
        tables: result.tables,
        primaryTable: result.primaryTable,
      }

      registerSession(session)
      setSessions((previous) => [...previous, session])
      setActiveSessionId(sessionId)
      setMessagesBySession((previous) => ({
        ...previous,
        [sessionId]: [buildWelcomeMessage(session)],
      }))
      setTracesBySession((previous) => ({ ...previous, [sessionId]: [] }))
      setUpload({
        phase: 'done',
        fileName: file.name,
        message: `Loaded ${result.tables.length} table${result.tables.length === 1 ? '' : 's'}.`,
      })
    } catch (error) {
      setUpload({
        phase: 'error',
        fileName: file.name,
        message: errorMessage(error),
      })
    }
  }, [])

  const selectSession = useCallback((sessionId: string) => {
    setActiveSessionId(sessionId)
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
        setIsStreaming(false)
        setStreamingSessionId(null)
        streamingSessionRef.current = null
        setTraceOpen(false)
        dbHandleRef.current = null
        setDbReady(false)
        await closeDuckDB()
        return
      }

      setSessions(remaining)
      setActiveSessionId((current) => (current === sessionId ? remaining[0].id : current))
    },
    [sessions],
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

      const updateAssistant = (updater: (message: ChatMessage) => ChatMessage) => {
        setMessagesBySession((previous) => {
          const list = previous[sessionId] ?? []
          return {
            ...previous,
            [sessionId]: list.map((message) =>
              message.id === assistantId ? updater(message) : message,
            ),
          }
        })
      }

      try {
        const result = await runAgentTurn({
          apiKey,
          model,
          session,
          history,
          userText: text,
          signal: controller.signal,
          onDelta: (delta) => {
            updateAssistant((message) => ({ ...message, content: message.content + delta }))
          },
          onTrace: (entry) => upsertTrace(sessionId, entry),
        })

        updateAssistant((message) => ({ ...message, content: result.text }))
      } catch (error) {
        if (controller.signal.aborted) {
          updateAssistant((message) => ({
            ...message,
            content:
              message.content.trim().length > 0
                ? `${message.content}\n\n_Stopped._`
                : '_Generation stopped._',
          }))
        } else {
          const message = errorMessage(error)
          updateAssistant((current) => ({
            ...current,
            error: true,
            content:
              current.content.trim().length > 0
                ? `${current.content}\n\n> **Agent error:** ${message}`
                : `> **Agent error:** ${message}`,
          }))
        }
      } finally {
        setIsStreaming(false)
        setStreamingSessionId(null)
        streamingSessionRef.current = null
        abortRef.current = null
      }
    },
    [activeSession, apiKey, isStreaming, messagesBySession, model, upsertTrace],
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

  const toggleTrace = useCallback(() => setTraceOpen((open) => !open), [])

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

  const value = useMemo<SessionContextValue>(
    () => ({
      dbReady,
      dbError,
      sessions,
      activeSession,
      messages,
      traces,
      isStreaming,
      streamingSessionId,
      upload,
      apiKey,
      model,
      settingsOpen,
      traceOpen,
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
      toggleTrace,
      setTraceOpen,
      exportTrace,
    }),
    [
      dbReady,
      dbError,
      sessions,
      activeSession,
      messages,
      traces,
      isStreaming,
      streamingSessionId,
      upload,
      apiKey,
      model,
      settingsOpen,
      traceOpen,
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
      toggleTrace,
      exportTrace,
    ],
  )

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSession(): SessionContextValue {
  const context = useContext(SessionContext)
  if (!context) {
    throw new Error('useSession must be used inside SessionProvider.')
  }
  return context
}
