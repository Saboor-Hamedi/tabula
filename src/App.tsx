import { useEffect, useState } from 'react'
import { ErrorBoundary } from './features/common/ErrorBoundary'
import { AppShell } from './features/AppShell'
import { SessionProvider } from './features/SessionProvider'
import { useAuth } from './features/auth/useAuth'
import { AuthScreen } from './features/auth/AuthScreen'
import { VerifyEmailScreen } from './features/auth/VerifyEmailScreen'
import { LandingPage } from './features/landing/LandingPage'

type ViewMode = 'landing' | 'auth' | 'verify' | 'app'

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

  // Demo mode hash enters app immediately
  if (hash === '#demo-mode') {
    return 'app'
  }

  // If already authenticated and on login hash, redirect to app
  if (isAuthed && (hash === '#login' || hash === '#signin' || hash === '#signup')) {
    window.location.hash = '#app'
    return 'app'
  }

  if (hash === '#login' || hash === '#signin' || hash === '#signup') {
    return 'auth'
  }
  if (hash === '#verify') {
    return 'verify'
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
  const {
    user,
    loading,
    isConfigured,
    needsVerification,
    refreshSession,
    resendVerificationEmail,
    signOut,
  } = useAuth()
  const [view, setView] = useState<ViewMode>(() => getInitialView(user, isConfigured))
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin')
  const [isDemoMode, setIsDemoMode] = useState<boolean>(() => {
    return typeof window !== 'undefined' && window.location.hash.toLowerCase() === '#demo-mode'
  })

  // Synchronize view state when user session loads or changes
  useEffect(() => {
    if (!loading) {
      if (user) {
        if (needsVerification && !isDemoMode) {
          setView('verify')
          return
        }
        const hash = window.location.hash.toLowerCase()
        if (hash === '#login' || hash === '#signin' || hash === '#signup' || view === 'auth' || view === 'verify') {
          window.location.hash = '#app'
          setView('app')
        }
      }
    }
  }, [user, loading, needsVerification, isDemoMode, view])

  // Listen to hash routing changes (#landing, #pricing, #app, #login, #demo-mode)
  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash.toLowerCase()
      const isAuthed = !!user || hasStoredSession()

      if (hash === '#demo-mode') {
        setIsDemoMode(true)
        setView('app')
      } else if (hash === '#login' || hash === '#signin') {
        if (isAuthed && !needsVerification) {
          window.location.hash = '#app'
          setView('app')
        } else if (needsVerification) {
          setView('verify')
        } else {
          setAuthMode('signin')
          setView('auth')
        }
      } else if (hash === '#signup' || hash === '#register') {
        if (isAuthed && !needsVerification) {
          window.location.hash = '#app'
          setView('app')
        } else if (needsVerification) {
          setView('verify')
        } else {
          setAuthMode('signup')
          setView('auth')
        }
      } else if (hash === '#verify') {
        setView('verify')
      } else if (hash === '#landing' || hash === '#pricing' || hash === '#features' || hash === '#demo' || hash === '#faq') {
        setView('landing')
      } else if (hash === '#app' || hash === '#workspace') {
        if (isConfigured && !isAuthed && !isDemoMode) {
          setView('auth')
        } else if (needsVerification && !isDemoMode) {
          setView('verify')
        } else {
          setView('app')
        }
      }
    }

    window.addEventListener('hashchange', handleHash)
    return () => window.removeEventListener('hashchange', handleHash)
  }, [user, isConfigured, needsVerification, isDemoMode])

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
          } else if (needsVerification) {
            setView('verify')
          } else {
            window.location.hash = '#app'
            setView('app')
          }
        }}
        onTryDemo={() => {
          setIsDemoMode(true)
          window.location.hash = '#demo-mode'
          setView('app')
        }}
      />
    )
  }

  // 2. Email Verification Gate (Milestone 1 - Prompt 4.2 & 4.3)
  if (view === 'verify' || (isConfigured && !loading && user && needsVerification && !isDemoMode)) {
    return (
      <VerifyEmailScreen
        email={user?.email}
        onVerified={async () => {
          const refreshed = await refreshSession()
          if (refreshed?.user?.email_confirmed_at) {
            window.location.hash = '#app'
            setView('app')
          }
        }}
        onRefresh={refreshSession}
        onResend={() => resendVerificationEmail()}
        onSignOut={async () => {
          await signOut()
          window.location.hash = '#landing'
          setView('landing')
        }}
      />
    )
  }

  // 3. Authentication Screen (Only when unauthenticated and not demo mode)
  if (view === 'auth' || (isConfigured && !loading && !user && !hasStoredSession() && !isDemoMode)) {
    return (
      <AuthScreen
        initialMode={authMode}
        onBackToHome={() => {
          window.location.hash = '#landing'
          setView('landing')
        }}
        onSuccess={() => {
          if (needsVerification) {
            setView('verify')
          } else {
            window.location.hash = '#app'
            setView('app')
          }
        }}
      />
    )
  }

  // 4. Full Analytical Workspace
  return (
    <SessionProvider>
      <AppShell isDemoMode={isDemoMode} />
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
