import type { ChatMessage, DatasetDigest, Session } from '../types'
import { getWorkspaceScope, workspaceCacheKey } from './scope'

/**
 * Tiny synchronous mirror of the account-scoped workspace.
 *
 * IndexedDB holds the durable copy, but it is async. Reading this cache on the
 * very first render means a refresh paints the previous dataset and transcript
 * immediately instead of flashing the empty upload screen while DuckDB warms up.
 */

const CACHE_VERSION = 1

export interface WorkspaceCache {
  version: number
  sessions: Session[]
  activeSessionId: string | null
  messagesBySession: Record<string, ChatMessage[]>
  digestBySession: Record<string, DatasetDigest>
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/** Reads the last synchronous workspace mirror for the current account. Invalid data is ignored. */
export function readWorkspaceCache(explicitScope?: string | null): WorkspaceCache | null {
  const scope = explicitScope === undefined ? getWorkspaceScope() : explicitScope
  if (!scope) return null

  try {
    const raw = window.localStorage.getItem(workspaceCacheKey(scope))
    if (!raw) return null

    const parsed: unknown = JSON.parse(raw)
    if (!isRecord(parsed) || parsed.version !== CACHE_VERSION) return null
    if (!Array.isArray(parsed.sessions)) return null

    return {
      version: CACHE_VERSION,
      sessions: parsed.sessions as Session[],
      activeSessionId:
        typeof parsed.activeSessionId === 'string' ? parsed.activeSessionId : null,
      messagesBySession: isRecord(parsed.messagesBySession)
        ? (parsed.messagesBySession as Record<string, ChatMessage[]>)
        : {},
      digestBySession: isRecord(parsed.digestBySession)
        ? (parsed.digestBySession as Record<string, DatasetDigest>)
        : {},
    }
  } catch {
    return null
  }
}

/** Writes the lightweight mirror after the durable snapshot is scheduled. */
export function saveWorkspaceCache(
  cache: Omit<WorkspaceCache, 'version'>,
  explicitScope?: string | null,
): void {
  const scope = explicitScope === undefined ? getWorkspaceScope() : explicitScope
  if (!scope) return

  try {
    window.localStorage.setItem(
      workspaceCacheKey(scope),
      JSON.stringify({ ...cache, version: CACHE_VERSION }),
    )
  } catch {
    // The cache is an optimization; quota failures must never break the app.
  }
}

export function clearWorkspaceCache(explicitScope?: string | null): void {
  const scope = explicitScope === undefined ? getWorkspaceScope() : explicitScope
  if (!scope) return

  try {
    window.localStorage.removeItem(workspaceCacheKey(scope))
  } catch {
    // Ignore private-browsing failures.
  }
}
