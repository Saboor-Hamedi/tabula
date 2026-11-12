import type { ReactNode } from 'react'
import { Navigate } from '../../core/router'
import { ROUTES } from '../../core/router/paths'
import { isOpenAccess } from './access'
import { useAuthLoading, useAuthUser, useIsAdmin } from './useProfile'

/**
 * The route gates.
 *
 * Every question about "who is allowed in" is answered here, once. A component
 * never re-implements the rules — it asks for what it needs.
 */

/** Shown while the session is still being read. */
function Boot() {
  return (
    <div className="app-boot" aria-busy="true">
      <span className="app-boot-mark" />
    </div>
  )
}

/**
 * Requires a signed-in account.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const user = useAuthUser()
  const loading = useAuthLoading()
  if (isOpenAccess()) return <>{children}</>
  if (loading) return <Boot />
  if (!user) return <Navigate to={ROUTES.signIn} />
  return <>{children}</>
}

/**
 * Requires a verified email address.
 *
 * An unverified account is sent to the verification screen instead of the
 * surface it asked for.
 */
export function RequireVerified({ children }: { children: ReactNode }) {
  const user = useAuthUser()
  const loading = useAuthLoading()
  if (isOpenAccess()) return <>{children}</>
  if (loading) return <Boot />
  if (!user) return <Navigate to={ROUTES.signIn} />
  if (!user.email || user.email_confirmed_at) return <>{children}</>
  return <Navigate to={ROUTES.verify} />
}

/**
 * Requires an administrator.
 *
 * The role comes from the profile row, which the database protects. The gate
 * only decides what the interface offers.
 */
export function RequireAdmin({ children }: { children: ReactNode }) {
  const isAdmin = useIsAdmin()
  const loading = useAuthLoading()
  if (loading) return <Boot />
  if (!isAdmin) return <Navigate to={ROUTES.dashboard} />
  return <>{children}</>
}
