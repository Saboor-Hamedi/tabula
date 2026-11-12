/**
 * The auth surface.
 *
 * One entry point for everything about "who is allowed in": the copy the
 * screens show, the gates that guard a route, and the hooks that read the
 * session.
 *
 *   copy.ts       the words
 *   guards.tsx    the route gates
 *   context.ts    the session context
 *   AuthProvider  the listener
 *   useAuth.ts    the hook
 *   useProfile.ts the cheap reads
 */

export { AUTH_COPY } from './copy'
export { isOpenAccess } from './access'
export { RequireAdmin, RequireAuth, RequireVerified } from './guards'
export { useAuth, type AuthState } from './useAuth'
export {
  clearAuthState,
  useAuthSnapshot,
  useAuthUser,
  useIsAdmin,
  useProfile,
} from './useProfile'
export { useDisplayName } from './display'
