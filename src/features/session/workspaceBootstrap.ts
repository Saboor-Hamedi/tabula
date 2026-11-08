import type { DuckDBHandle } from '../../core/duckdb/initDuckDB'
import { initDuckDB } from '../../core/duckdb/initDuckDB'
import { ingestCSV } from '../../core/duckdb/ingestCSV'
import { ingestExcel } from '../../core/duckdb/ingestExcel'
import { buildDatasetDigest } from '../../core/profiling/buildDigest'
import { buildLocalSuggestions } from '../../core/agent/suggestions'
import { loadPersistedWorkspace, loadSessionFile } from '../../core/storage/persistence'
import { registerSession } from '../../core/storage/sessions'
import type { ChatMessage, DatasetDigest, Session, ToolTraceEntry } from '../../core/types'

/** Restores fields missing from sessions saved by an earlier app version. */
export function normalizeSession(session: Session): Session {
  const tables = Array.isArray(session.tables) ? session.tables : []
  return {
    ...session,
    fileSize: session.fileSize ?? 0,
    tables,
    primaryTable: session.primaryTable ?? tables[0]?.name ?? null,
  }
}

/** Clears transient suggestion flags and repairs malformed cached messages. */
export function normalizeMessages(messages: ChatMessage[] | undefined): ChatMessage[] {
  if (!Array.isArray(messages)) return []
  return messages
    .filter((message) => message !== null && typeof message === 'object')
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
export async function bootstrapWorkspace(): Promise<BootstrapResult> {
  const handle = await initDuckDB()
  const persisted = await loadPersistedWorkspace()
  const sessions: Session[] = []
  const messagesBySession: Record<string, ChatMessage[]> = {}
  const tracesBySession: Record<string, ToolTraceEntry[]> = {}
  const digestBySession: Record<string, DatasetDigest> = {}

  for (const record of persisted.sessions) {
    const session = normalizeSession(record.session)
    sessions.push(session)
    messagesBySession[session.id] = normalizeMessages(record.messages)
    tracesBySession[session.id] = record.traces ?? []
    if (record.digest) digestBySession[session.id] = record.digest
    registerSession(session)

    const file = await loadSessionFile(session.id)
    if (!file) continue

    try {
      if (session.fileType === 'csv') {
        await ingestCSV({ handle, file, sessionId: session.id, schemaName: session.schemaName })
      } else {
        await ingestExcel({ handle, file, sessionId: session.id, schemaName: session.schemaName })
      }

      const digest = await buildDatasetDigest(handle.connection, session)
      digestBySession[session.id] = digest
      messagesBySession[session.id] = messagesBySession[session.id].map((message) =>
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
