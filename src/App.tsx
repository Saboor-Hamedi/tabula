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
import { FeaturesPage, Landing, PricingPage } from './features/landing'
import { Article, Insights } from './features/posts'
import { SourcesPage } from './features/sources'

/**
 * The route table.
 *
 * Clean pathname URLs:
 *   /                      the home page
 *   /features              capabilities, comparison & privacy architecture
 *   /sources               open research sources & ready-to-query CSV files
 *   /pricing               plans, quotas & FAQ
 *   /posts                 published insights index
 *   /posts/:slug           one published insight
 *   /:username/app         Analyse — the signed-in dashboard (also /app)
 *   /:username/workspace   the chat workspace (also /workspace)
 *   /login /signup /verify
 */

function Workspace() {
  const user = useAuthUser()

  return (
    <SessionProvider key={user?.id ?? 'guest'}>
      <AppShell />
    </SessionProvider>
  )
}

/** Keeps the signed-in user's username slug reflected cleanly in `/<username>/app` and `/<username>/workspace`. */
function UserUrlSync() {
  const { path, query, navigate } = useRouter()
  const user = useAuthUser()
  const userSlug = useUserSlug()

  useEffect(() => {
    if (!userSlug || user?.is_anonymous) return
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
  }, [path, query, userSlug, user?.is_anonymous, navigate])

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

  const workspaceElement = <Workspace />

  return (
    <>
      <UserUrlSync />
      <Routes>
        <Route path={ROUTES.home} element={<Landing />} />
        <Route path="/landing" element={<Navigate to={ROUTES.home} />} />
        <Route path={ROUTES.features} element={<FeaturesPage />} />
        <Route path={ROUTES.sources} element={<SourcesPage />} />
        <Route path={ROUTES.pricing} element={<PricingPage />} />
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
        <Route path={ROUTES.notFound} element={<Navigate to={ROUTES.home} />} />
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
