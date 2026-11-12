import { STORAGE_KEYS } from '../constants'
import { supabase } from '../supabase/client'
import { getAuthSnapshot } from '../supabase/session'

const LEGACY_DB_NAME = 'tabula-workspace'
let legacyPurged = false

function sanitizeScopeSegment(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

/**
 * Returns an isolated storage namespace for the currently signed-in account.
 *
 * When Supabase auth is enabled and no user is signed in, returns `null` so
 * unauthenticated states never read or write another account's data.
 */
export function getWorkspaceScope(explicitUserId?: string | null): string | null {
  const userId = explicitUserId ?? getAuthSnapshot().user?.id ?? null
  if (userId) {
    const clean = sanitizeScopeSegment(userId)
    return clean ? `user_${clean}` : null
  }
  if (supabase !== null) {
    return null
  }
  return 'local'
}

export function workspaceDbName(scope: string): string {
  return `tabula-workspace:${scope}`
}

export function workspaceCacheKey(scope: string): string {
  return `${STORAGE_KEYS.workspaceCache}:${scope}`
}

export function stickyNotesStorageKey(scope: string | null): string {
  return scope ? `tabula-sticky-notes:v1:${scope}` : 'tabula-sticky-notes:v1:anon'
}

/**
 * Removes legacy unscoped workspace storage left over from single-workspace builds
 * so old data can never leak across accounts on the same machine.
 */
export function purgeLegacyUnscopedStorage(): void {
  if (legacyPurged) return
  legacyPurged = true

  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(STORAGE_KEYS.workspaceCache)
      window.localStorage.removeItem('tabula-sticky-notes:v1')
    }
  } catch {
    // Ignore storage access errors in restricted modes.
  }

  try {
    if (typeof indexedDB !== 'undefined') {
      indexedDB.deleteDatabase(LEGACY_DB_NAME)
    }
  } catch {
    // Ignore IndexedDB errors in restricted modes.
  }
}
