import { ROUTES } from '../router/paths'
import { clearSessionRegistry } from '../storage/sessions'
import { resetDatabaseConnections } from '../storage/persistence'
import { supabase } from './client'
import { clearAuthState } from './session'
import { clearUsageState } from './usage'

async function clearRuntimeWorkspaceState(): Promise<void> {
  clearSessionRegistry()
  resetDatabaseConnections()

  try {
    const { closeDuckDB } = await import('../duckdb/closeDuckDB')
    await closeDuckDB()
  } catch {
    // Ignore DuckDB cleanup failures when workspace was never opened.
  }

  try {
    const { resetPythonEngine } = await import('../python')
    resetPythonEngine()
  } catch {
    // Ignore Python cleanup failures when worker was never started.
  }
}

/**
 * Signs the account out and redirects straight to `/landing`.
 *
 * One implementation for the header, sidebar, settings/account modal, and
 * verification screen, so local workspace state is torn down cleanly and the
 * router never bounces to `/login`.
 */
export async function signOutAccount(): Promise<void> {
  if (typeof window !== 'undefined' && window.location.pathname !== ROUTES.landing) {
    window.history.replaceState(null, '', ROUTES.landing)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }

  await clearRuntimeWorkspaceState()
  clearUsageState()

  if (supabase) {
    await supabase.auth.signOut()
  }
  clearAuthState()
}
