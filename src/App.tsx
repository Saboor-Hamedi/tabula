import { useEffect } from 'react'
import { ErrorBoundary } from './features/common/ErrorBoundary'
import { Navigate, Route, RouterProvider, Routes, useRouter } from './core/router'
import { matchPath } from './core/router/match'
import { ROUTES, userPath } from './core/router/paths'
import { AppShell } from './features/AppShell'
import { SessionProvider } from './features/SessionProvider'
import { RequireAuth, RequireVerified } from './features/auth/auth'
import { AuthProvider } from './features/auth/AuthProvider'
import { AuthScreen } from './features/auth/AuthScreen'
import { useAuthUser, useUserSlug } from './features/auth/useProfile'
import { VerifyEmailScreen } from './features/auth/VerifyEmailScreen'
import { PricingModal } from './features/billing/PricingModal'
import { Analyse } from './features/dashboard'
import { Landing } from './features/landing'
import { Article, Insights } from './features/posts'

/**
 * The route table.
 *
 * Clean pathname URLs:
 *   /landing               the front page
 *   /:username/app         Analyse — the signed-in home (also /app)
 *   /:username/workspace   the chat workspace (also /workspace)
 *   /insights              the published insights index
 *   /insights/:slug        one published insight
 *   /login /signup /verify
 */

function Workspace() {
  const user = useAuthUser()
  return (
    <SessionProvider key={user?.id ?? 'anon'}>
      <AppShell />
    </SessionProvider>
  )
}

/** Keeps the signed-in user's username slug reflected cleanly in `/<username>/app` and `/<username>/workspace`. */
function UserUrlSync() {
  const { path, query, navigate } = useRouter()
  const userSlug = useUserSlug()

  useEffect(() => {
    if (!userSlug) return
    const search = query.toString()
    const suffix = search ? `?${search}` : ''

    const dashMatch = matchPath(ROUTES.userDashboard, path)
    if (path === ROUTES.dashboard || (dashMatch && dashMatch.username !== userSlug)) {
      navigate(`${userPath('/app', userSlug)}${suffix}`, { replace: true })
      return
    }

    const workMatch = matchPath(ROUTES.userWorkspace, path)
    if (path === ROUTES.workspace || (workMatch && workMatch.username !== userSlug)) {
      navigate(`${userPath('/workspace', userSlug)}${suffix}`, { replace: true })
    }
  }, [path, query, userSlug, navigate])

  return null
}

export function AppRoutes() {
  const dashboardElement = (
    <RequireAuth>
      <RequireVerified>
        <Analyse />
      </RequireVerified>
    </RequireAuth>
  )

  const workspaceElement = (
    <RequireAuth>
      <RequireVerified>
        <Workspace />
      </RequireVerified>
    </RequireAuth>
  )

  return (
    <>
      <UserUrlSync />
      <Routes>
        <Route path={ROUTES.landing} element={<Landing />} />
        <Route path={ROUTES.dashboard} element={dashboardElement} />
        <Route path={ROUTES.userDashboard} element={dashboardElement} />
        <Route path={ROUTES.workspace} element={workspaceElement} />
        <Route path={ROUTES.userWorkspace} element={workspaceElement} />
        <Route path={ROUTES.posts} element={<Insights />} />
        <Route path={ROUTES.post} element={<Article />} />
        <Route path={ROUTES.insights} element={<Insights />} />
        <Route path={ROUTES.insight} element={<Article />} />
        <Route path={ROUTES.signIn} element={<AuthScreen initialMode="signin" />} />
        <Route path={ROUTES.signUp} element={<AuthScreen initialMode="signup" />} />
        <Route path={ROUTES.verify} element={<VerifyEmailScreen />} />
        <Route path={ROUTES.notFound} element={<Navigate to={ROUTES.landing} />} />
      </Routes>
    </>
  )
}

/**
 * The application root.
 *
 * The router owns the location, the error boundary owns the failures, and the
 * auth gates own the session.
 */
export function AppRoot() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <RouterProvider>
          <AppRoutes />
          <PricingModal />
        </RouterProvider>
      </AuthProvider>
    </ErrorBoundary>
  )
}

export default function App() {
  return <AppRoot />
}
