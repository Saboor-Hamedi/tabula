import type { User } from '@supabase/supabase-js'
import type { UserProfile } from './types'

/**
 * The shared auth store.
 *
 * `useAuth` owns the Supabase listener and must be mounted once. Everything
 * else — the header, the publish button, the dashboard — reads the session
 * from here instead of opening a second listener, which is what keeps a page
 * with a hundred messages from re-rendering on every auth event.
 */

export interface AuthSnapshot {
  user: User | null
  profile: UserProfile | null
  /** True until the first session has been read. */
  loading: boolean
}

type Listener = () => void

let snapshot: AuthSnapshot = { user: null, profile: null, loading: true }
const listeners = new Set<Listener>()

/** The current session. The object identity only changes when it does. */
export function getAuthSnapshot(): AuthSnapshot {
  return snapshot
}

/** Publishes a new session to every subscriber. */
export function setAuthState(next: Partial<AuthSnapshot>): void {
  snapshot = { ...snapshot, ...next }
  for (const listener of listeners) {
    listener()
  }
}

/** Subscribes to session changes. Returns an unsubscribe function. */
export function subscribeAuth(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Clears the session, for example after signing out. */
export function clearAuthState(): void {
  setAuthState({ user: null, profile: null, loading: false })
}
