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
import { useAuthUser, useProfile, useUserSlug } from './features/auth/useProfile'
import { VerifyEmailScreen } from './features/auth/VerifyEmailScreen'
import { PricingModal } from './features/billing/PricingModal'
import { Analyse } from './features/dashboard'
import { Header, PublicHeaderProvidedContext } from './features/header/Header'
import { FeaturesPage, Landing, PricingPage } from './features/landing'
import { LuminaArticlePage, LuminaDocPage, LuminaPostsPage } from './features/lumina'
import { Article, Insights } from './features/posts'
import { SourcesPage } from './features/sources'
import { SuspendedPage } from './features/suspend'

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

function DashboardGuard() {
  const { navigate } = useRouter()
  const profile = useProfile()
  const isSuspended = Boolean(profile?.is_suspended && profile.role !== 'admin')

  useEffect(() => {
    if (isSuspended) {
      navigate(ROUTES.suspended, { replace: true })
    }
  }, [isSuspended, navigate])

  if (isSuspended) {
    return <SuspendedPage reasonOverride={profile?.suspended_reason} />
  }
  return <Analyse />
}

function Workspace() {
  const { navigate } = useRouter()
  const user = useAuthUser()
  const profile = useProfile()
  const isSuspended = Boolean(profile?.is_suspended && profile.role !== 'admin')

  useEffect(() => {
    if (isSuspended) {
      navigate(ROUTES.suspended, { replace: true })
    }
  }, [isSuspended, navigate])

  if (isSuspended) {
    return <SuspendedPage reasonOverride={profile?.suspended_reason} />
  }

  return (
    <SessionProvider key={user?.id ?? 'guest'}>
      <AppShell />
    </SessionProvider>
  )
}

function isPublicMarketingOrPostsRoute(path: string): boolean {
  return (
    path === '/' ||
    path === '/landing' ||
    path === ROUTES.features ||
    path === ROUTES.sources ||
    path.startsWith('/sources/') ||
    path === ROUTES.pricing ||
    path === ROUTES.posts ||
    path.startsWith('/posts/') ||
    path === ROUTES.insights ||
    path.startsWith('/insights/')
  )
}

/** Keeps the signed-in user's username slug reflected cleanly in `/<username>/app` and `/<username>/workspace`. */
function UserUrlSync() {
  const { path, query, navigate } = useRouter()
  const user = useAuthUser()
  const profile = useProfile()
  const userSlug = useUserSlug()

  useEffect(() => {
    if (!userSlug || user?.is_anonymous) return
    if (profile?.is_suspended && profile.role !== 'admin') return
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
  const { path } = useRouter()
  const isPublicPage = isPublicMarketingOrPostsRoute(path)

  const dashboardElement = (
    <RequireAuth>
      <RequireVerified>
        <DashboardGuard />
      </RequireVerified>
    </RequireAuth>
  )

  const workspaceElement = <Workspace />

  return (
    <>
      <UserUrlSync />
      {isPublicPage ? <Header variant="page" /> : null}
      <PublicHeaderProvidedContext.Provider value={isPublicPage}>
        <div key={isPublicPage ? path : 'app-shell'} className={isPublicPage ? 'public-route-stage' : undefined}>
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
            <Route path={ROUTES.lumina} element={<LuminaDocPage />} />
            <Route path={ROUTES.luminaPosts} element={<LuminaPostsPage />} />
            <Route path={ROUTES.luminaPostNew} element={<LuminaPostsPage openCreateInitially />} />
            <Route path={ROUTES.luminaPost} element={<LuminaArticlePage />} />
            <Route path={ROUTES.luminaDocsWildcard} element={<LuminaDocPage />} />
            <Route path={ROUTES.signIn} element={<AuthScreen initialMode="signin" />} />
            <Route path={ROUTES.signUp} element={<AuthScreen initialMode="signup" />} />
            <Route path={ROUTES.verify} element={<VerifyEmailScreen />} />
            <Route path={ROUTES.suspended} element={<SuspendedPage />} />
            <Route path={ROUTES.notFound} element={<Navigate to={ROUTES.home} />} />
          </Routes>
        </div>
      </PublicHeaderProvidedContext.Provider>
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
