import type { DuckDBHandle } from '../../core/duckdb/initDuckDB'
import { initDuckDB } from '../../core/duckdb/initDuckDB'
import { ingestCSV } from '../../core/duckdb/ingestCSV'
import { ingestExcel } from '../../core/duckdb/ingestExcel'
import { buildDatasetDigest } from '../../core/profiling/buildDigest'
import { buildLocalSuggestions } from '../../core/agent/suggestions'
import { loadPersistedWorkspace, loadSessionFile } from '../../core/storage/persistence'
import { purgeLegacyUnscopedStorage } from '../../core/storage/scope'
import { clearSessionRegistry, registerSession } from '../../core/storage/sessions'
import type { ChatMessage, DatasetDigest, Session, ToolTraceEntry } from '../../core/types'

/** Restores fields missing from sessions saved by an earlier app version. */
export function normalizeSession(session: Session): Session {
  if (!session || typeof session !== 'object') {
    return {
      id: '',
      fileName: 'Untitled',
      fileType: 'csv',
      fileSize: 0,
      uploadedAt: Date.now(),
      schemaName: '',
      tables: [],
      primaryTable: null,
    }
  }
  const tables = Array.isArray(session.tables) ? session.tables : []
  return {
    ...session,
    fileSize: typeof session.fileSize === 'number' ? session.fileSize : 0,
    tables,
    primaryTable: session.primaryTable ?? tables[0]?.name ?? null,
  }
}

/** Clears transient suggestion flags, filters synthetic welcome messages, and repairs malformed cached messages. */
export function normalizeMessages(messages: ChatMessage[] | undefined): ChatMessage[] {
  if (!Array.isArray(messages)) return []
  return messages
    .filter((message) => {
      if (message === null || typeof message !== 'object' || message.welcome) return false
      const raw = typeof message.content === 'string' ? message.content.trim() : ''
      if (
        message.error &&
        (raw.length === 0 ||
          raw.includes('AI_APICallError: Too Many Requests') ||
          raw.includes('You have finished your trial tokens for this month.'))
      ) {
        return false
      }
      return true
    })
    .map((message) => ({
      ...message,
      content: typeof message.content === 'string' ? message.content : '',
      suggestions: Array.isArray(message.suggestions) ? message.suggestions : [],
      suggestionsPending: false,
    }))
}

export interface BootstrapResult {
  handle: DuckDBHandle
  sessions: Session[]
  messagesBySession: Record<string, ChatMessage[]>
  tracesBySession: Record<string, ToolTraceEntry[]>
  digestBySession: Record<string, DatasetDigest>
  activeSessionId: string | null
}

/**
 * Opens the local analysis engine and rebuilds every persisted session from its
 * stored file. Kept outside the React component so bootstrap logic can evolve
 * independently from UI state.
 */
export async function bootstrapWorkspace(scope: string | null): Promise<BootstrapResult> {
  purgeLegacyUnscopedStorage()
  clearSessionRegistry()
  const handle = await initDuckDB()
  const persisted = await loadPersistedWorkspace(scope)
  const sessions: Session[] = []
  const messagesBySession: Record<string, ChatMessage[]> = {}
  const tracesBySession: Record<string, ToolTraceEntry[]> = {}
  const digestBySession: Record<string, DatasetDigest> = {}

  const persistedSessions = Array.isArray(persisted?.sessions) ? persisted.sessions : []
  for (const record of persistedSessions) {
    if (!record || !record.session) continue
    const session = normalizeSession(record.session)
    if (!session.id) continue
    sessions.push(session)
    messagesBySession[session.id] = normalizeMessages(record.messages)
    tracesBySession[session.id] = Array.isArray(record.traces) ? record.traces : []
    if (record.digest) digestBySession[session.id] = record.digest
    registerSession(session)

    const file = await loadSessionFile(session.id, scope)
    if (!file) continue

    try {
      if (session.fileType === 'csv') {
        await ingestCSV({ handle, file, sessionId: session.id, schemaName: session.schemaName })
      } else {
        await ingestExcel({
          handle,
          file,
          sessionId: session.id,
          schemaName: session.schemaName,
          selectedSheets: session.selectedSheets,
        })
      }

      const digest = await buildDatasetDigest(handle.connection, session)
      digestBySession[session.id] = digest
      messagesBySession[session.id] = (messagesBySession[session.id] ?? []).map((message) =>
        message.welcome
          ? {
              ...message,
              suggestions: buildLocalSuggestions(session, digest),
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
