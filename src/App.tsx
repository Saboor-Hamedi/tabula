import { useEffect, useState } from 'react'
import { ErrorBoundary } from './features/common/ErrorBoundary'
import { AppShell } from './features/AppShell'
import { SessionProvider } from './features/SessionProvider'
import { useAuth } from './features/auth/useAuth'
import { AuthScreen } from './features/auth/AuthScreen'
import { LandingPage } from './features/landing/LandingPage'

type ViewMode = 'landing' | 'auth' | 'app'

function getInitialView(user: unknown, isConfigured: boolean): ViewMode {
  if (typeof window === 'undefined') return 'landing'
  const hash = window.location.hash.toLowerCase()

  if (hash === '#login' || hash === '#signin' || hash === '#signup') {
    return 'auth'
  }
  if (hash === '#landing' || hash === '#features' || hash === '#pricing' || hash === '#demo' || hash === '#faq') {
    return 'landing'
  }
  if (hash === '#app' || hash === '#workspace') {
    return user || !isConfigured ? 'app' : 'auth'
  }

  // Default: Authenticated users go straight to workspace; new visitors see the landing page!
  return user ? 'app' : 'landing'
}

function AppRoot() {
  const { user, loading, isConfigured } = useAuth()
  const [view, setView] = useState<ViewMode>(() => getInitialView(user, isConfigured))
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin')

  // Synchronize view state if user logs in or out
  useEffect(() => {
    if (!loading) {
      if (user && view === 'auth') {
        setView('app')
      }
    }
  }, [user, loading, view])

  // Listen to hash routing changes (#landing, #pricing, #app, #login)
  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash.toLowerCase()
      if (hash === '#login' || hash === '#signin') {
        setAuthMode('signin')
        setView('auth')
      } else if (hash === '#signup' || hash === '#register') {
        setAuthMode('signup')
        setView('auth')
      } else if (hash === '#landing' || hash === '#pricing' || hash === '#features' || hash === '#demo' || hash === '#faq') {
        setView('landing')
      } else if (hash === '#app' || hash === '#workspace') {
        if (isConfigured && !user) {
          setView('auth')
        } else {
          setView('app')
        }
      }
    }

    window.addEventListener('hashchange', handleHash)
    return () => window.removeEventListener('hashchange', handleHash)
  }, [user, isConfigured])

  // If Supabase is configured and checking initial session, show a sleek loading splash
  if (isConfigured && loading) {
    return (
      <div className="auth-splash-loading">
        <div className="auth-splash-spinner" />
        <span>Loading Tabula workspace…</span>
      </div>
    )
  }

  // 1. Landing / Front Page (Clean, separated, totally amazing product showcase)
  if (view === 'landing') {
    return (
      <LandingPage
        isAuthenticated={!!user}
        userEmail={user?.email}
        onNavigateToAuth={(mode = 'signin') => {
          setAuthMode(mode)
          window.location.hash = mode === 'signup' ? '#signup' : '#login'
          setView('auth')
        }}
        onNavigateToApp={() => {
          if (isConfigured && !user) {
            setAuthMode('signin')
            setView('auth')
          } else {
            window.location.hash = '#app'
            setView('app')
          }
        }}
      />
    )
  }

  // 2. Authentication Screen (Strict gate before accessing workspace)
  if (view === 'auth' || (isConfigured && !user)) {
    return (
      <AuthScreen
        initialMode={authMode}
        onBackToHome={() => {
          window.location.hash = '#landing'
          setView('landing')
        }}
        onSuccess={() => {
          window.location.hash = '#app'
          setView('app')
        }}
      />
    )
  }

  // 3. Full Analytical Workspace (App Shell)
  return (
    <SessionProvider>
      <AppShell />
    </SessionProvider>
  )
}

function App() {
  return (
    <ErrorBoundary>
      <AppRoot />
    </ErrorBoundary>
  )
}

export default App
