import { useEffect, type MutableRefObject } from 'react'
import { saveActiveSessionId, savePersistedSession } from '../../core/storage/persistence'
import { saveWorkspaceCache } from '../../core/storage/workspaceCache'
import type { ChatMessage, DatasetDigest, Session, ToolTraceEntry } from '../../core/types'

interface WorkspacePersistenceInput {
  ready: MutableRefObject<boolean>
  sessions: Session[]
  activeSessionId: string | null
  messagesBySession: Record<string, ChatMessage[]>
  tracesBySession: Record<string, ToolTraceEntry[]>
  digestBySession: Record<string, DatasetDigest>
  isStreaming: boolean
}

/**
 * Debounced durable persistence plus the synchronous first-paint mirror.
 * Keeping this in a hook stops the provider from growing another responsibility.
 */
export function useWorkspacePersistence({
  ready,
  sessions,
  activeSessionId,
  messagesBySession,
  tracesBySession,
  digestBySession,
  isStreaming,
}: WorkspacePersistenceInput): void {
  useEffect(() => {
    if (!ready.current || isStreaming) return
    const timer = window.setTimeout(() => {
      saveWorkspaceCache({
        sessions,
        activeSessionId,
        messagesBySession,
        digestBySession,
      })
      for (const session of sessions) {
        void savePersistedSession({
          id: session.id,
          session,
          messages: messagesBySession[session.id] ?? [],
          traces: tracesBySession[session.id] ?? [],
          digest: digestBySession[session.id],
          updatedAt: Date.now(),
        })
      }
    }, 350)
    return () => window.clearTimeout(timer)
  }, [
    activeSessionId,
    digestBySession,
    isStreaming,
    messagesBySession,
    ready,
    sessions,
    tracesBySession,
  ])

  useEffect(() => {
    if (!ready.current) return
    void saveActiveSessionId(activeSessionId)
  }, [activeSessionId, ready])
}
