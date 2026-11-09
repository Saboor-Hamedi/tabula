import { useEffect, useState } from 'react'
import { ErrorBoundary } from './features/common/ErrorBoundary'
import { AppShell } from './features/AppShell'
import { SessionProvider } from './features/SessionProvider'
import { useAuth } from './features/auth/useAuth'
import { AuthScreen } from './features/auth/AuthScreen'
import { LandingPage } from './features/landing/LandingPage'

type ViewMode = 'landing' | 'auth' | 'app'

/** Synchronously checks if Supabase has stored an authenticated session in localStorage */
function hasStoredSession(): boolean {
  if (typeof window === 'undefined') return false
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) {
        const val = localStorage.getItem(key)
        if (val && JSON.parse(val)?.access_token) return true
      }
    }
  } catch {
    // Ignore storage errors
  }
  return false
}

function getInitialView(user: unknown, isConfigured: boolean): ViewMode {
  if (typeof window === 'undefined') return 'landing'
  const hash = window.location.hash.toLowerCase()
  const isAuthed = !!user || hasStoredSession()

  // If already authenticated and on login hash, redirect to app
  if (isAuthed && (hash === '#login' || hash === '#signin' || hash === '#signup')) {
    window.location.hash = '#app'
    return 'app'
  }

  if (hash === '#login' || hash === '#signin' || hash === '#signup') {
    return 'auth'
  }
  if (hash === '#landing' || hash === '#features' || hash === '#pricing' || hash === '#demo' || hash === '#faq') {
    return 'landing'
  }
  if (hash === '#app' || hash === '#workspace') {
    return isAuthed || !isConfigured ? 'app' : 'auth'
  }

  // Default: Authenticated users go straight to workspace; new visitors see the landing page
  return isAuthed ? 'app' : 'landing'
}

function AppRoot() {
  const { user, loading, isConfigured } = useAuth()
  const [view, setView] = useState<ViewMode>(() => getInitialView(user, isConfigured))
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin')

  // Synchronize view state when user session loads or changes
  useEffect(() => {
    if (!loading) {
      if (user) {
        const hash = window.location.hash.toLowerCase()
        if (hash === '#login' || hash === '#signin' || hash === '#signup' || view === 'auth') {
          window.location.hash = '#app'
          setView('app')
        }
      }
    }
  }, [user, loading, view])

  // Listen to hash routing changes (#landing, #pricing, #app, #login)
  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash.toLowerCase()
      const isAuthed = !!user || hasStoredSession()

      if (hash === '#login' || hash === '#signin') {
        if (isAuthed) {
          window.location.hash = '#app'
          setView('app')
        } else {
          setAuthMode('signin')
          setView('auth')
        }
      } else if (hash === '#signup' || hash === '#register') {
        if (isAuthed) {
          window.location.hash = '#app'
          setView('app')
        } else {
          setAuthMode('signup')
          setView('auth')
        }
      } else if (hash === '#landing' || hash === '#pricing' || hash === '#features' || hash === '#demo' || hash === '#faq') {
        setView('landing')
      } else if (hash === '#app' || hash === '#workspace') {
        if (isConfigured && !isAuthed) {
          setView('auth')
        } else {
          setView('app')
        }
      }
    }

    window.addEventListener('hashchange', handleHash)
    return () => window.removeEventListener('hashchange', handleHash)
  }, [user, isConfigured])

  // If Supabase is configured and verifying initial session, show sleek workspace loader
  if (isConfigured && loading && hasStoredSession()) {
    return (
      <div className="auth-splash-loading">
        <div className="auth-splash-spinner" />
        <span>Loading Tabula workspace…</span>
      </div>
    )
  }

  // 1. Landing / Front Page
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
          if (isConfigured && !user && !hasStoredSession()) {
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

  // 2. Authentication Screen (Only when unauthenticated)
  if (view === 'auth' || (isConfigured && !loading && !user && !hasStoredSession())) {
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

  // 3. Full Analytical Workspace
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
