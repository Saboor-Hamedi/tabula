import { useSyncExternalStore } from 'react'
import { slugifyUsername } from '../../core/router/paths'
import {
  clearAuthState,
  getAuthSnapshot,
  subscribeAuth,
  type AuthSnapshot,
} from '../../core/supabase/session'
import type { UserProfile } from '../../core/supabase/types'

/**
 * Reads the signed-in session from the shared store.
 *
 * The workspace mounts `useAuth` once; these hooks let any component know who
 * is signed in and whether they may publish, without opening a second
 * Supabase auth listener.
 */
export function useAuthSnapshot(): AuthSnapshot {
  return useSyncExternalStore(subscribeAuth, getAuthSnapshot, getAuthSnapshot)
}

/** The signed-in account, if there is one. */
export function useAuthUser() {
  return useAuthSnapshot().user
}

/** The profile row of the signed-in account. */
export function useProfile(): UserProfile | null {
  return useAuthSnapshot().profile
}

/** Clean URL username slug derived from display name or email local-part. */
export function useUserSlug(): string | null {
  const { user, profile } = useAuthSnapshot()
  const raw = profile?.display_name || user?.email?.split('@')[0] || null
  return slugifyUsername(raw)
}

/** True when the signed-in account is an administrator. */
export function useIsAdmin(): boolean {
  return useProfile()?.role === 'admin'
}

/** True until the first session has been read. */
export function useAuthLoading(): boolean {
  return useAuthSnapshot().loading
}

/** Clears the local session. The caller performs the actual sign-out. */
export { clearAuthState }
