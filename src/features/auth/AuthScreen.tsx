import { useEffect, useState, type FormEvent } from 'react'
import logoUrl from '../../assets/logo.png'
import { supabase } from '../../core/supabase/client'
import { useRouter } from '../../core/router'
import { ROUTES } from '../../core/router/paths'
import {
  AlertIcon,
  ArrowRightIcon,
  CheckIcon,
  EyeIcon,
  EyeOffIcon,
  LockIcon,
  ShieldCheckIcon,
} from '../common/Icons'
import { Header } from '../header/Header'
import { useAuth } from './useAuth'
import {
  describeAuthError,
  fetchProviderAvailability,
  type OAuthProvider,
  type ProviderAvailability,
} from './providers'

type AuthMode = 'signin' | 'signup' | 'forgot-password' | 'magic-link' | 'update-password'

interface AuthScreenProps {
  initialMode?: 'signin' | 'signup'
}

export function AuthScreen({ initialMode = 'signin' }: AuthScreenProps) {
  const { navigate } = useRouter()
  const { passwordRecovery, updatePassword, clearPasswordRecovery } = useAuth()

  const onSuccess = () => navigate(ROUTES.workspace, { replace: true })
  const [mode, setMode] = useState<AuthMode>(() =>
    passwordRecovery ? 'update-password' : initialMode,
  )
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [honeypot, setHoneypot] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [socialLoading, setSocialLoading] = useState<'google' | 'github' | null>(null)
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null)
  const [providers, setProviders] = useState<ProviderAvailability | null>(null)

  const isSignUp = mode === 'signup'

  // Sync mode whenever route switches between /login (signin) and /signup (signup)
  useEffect(() => {
    if (passwordRecovery) {
      setMode('update-password')
      setMessage(null)
      return
    }
    setMode(initialMode)
    setMessage(null)
  }, [initialMode, passwordRecovery])

  useEffect(() => {
    let active = true
    void fetchProviderAvailability().then((availability) => {
      if (active) setProviders(availability)
    })
    return () => {
      active = false
    }
  }, [])

  const switchMode = (next: AuthMode) => {
    setMode(next)
    setMessage(null)
    if (next === 'signin') navigate(ROUTES.signIn, { replace: true })
    if (next === 'signup') navigate(ROUTES.signUp, { replace: true })
  }

  const handleOAuthSignIn = async (provider: OAuthProvider) => {
    if (!supabase) {
      setMessage({
        type: 'error',
        text: 'Social sign-in is currently unavailable.',
      })
      return
    }
    setSocialLoading(provider)
    setMessage(null)
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/workspace`,
        },
      })
      if (error) throw error
    } catch (err: unknown) {
      setMessage({
        type: 'error',
        text: describeAuthError(err, provider),
      })
      setSocialLoading(null)
    }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()

    // Honeypot bot protection
    if (honeypot.trim().length > 0) {
      setMessage({
        type: 'success',
        text: 'Account created! Please check your email inbox.',
      })
      return
    }

    if (!supabase) {
      setMessage({
        type: 'error',
        text: 'Authentication is not configured right now.',
      })
      return
    }

    if (mode === 'update-password') {
      if (!password || password.length < 6) {
        setMessage({ type: 'error', text: 'New password must be at least 6 characters.' })
        return
      }
      if (password !== confirmPassword) {
        setMessage({ type: 'error', text: 'Passwords do not match.' })
        return
      }
      setLoading(true)
      setMessage(null)
      try {
        const { error } = await updatePassword(password)
        if (error) throw error
        setMessage({ type: 'success', text: 'Password updated! Opening your workspace…' })
        setTimeout(() => onSuccess(), 800)
      } catch (err: unknown) {
        setMessage({ type: 'error', text: describeAuthError(err) })
      } finally {
        setLoading(false)
      }
      return
    }

    const cleanEmail = email.trim()
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setMessage({ type: 'error', text: 'Please enter a valid email address.' })
      return
    }

    setLoading(true)
    setMessage(null)

    try {
      if (mode === 'forgot-password') {
        const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
          redirectTo: `${window.location.origin}/login?type=recovery`,
        })
        if (error) throw error
        setMessage({
          type: 'success',
          text: 'Reset link sent — check your inbox to choose a new password.',
        })
        return
      }

      if (mode === 'magic-link') {
        const { error } = await supabase.auth.signInWithOtp({
          email: cleanEmail,
          options: {
            emailRedirectTo: `${window.location.origin}/workspace`,
          },
        })
        if (error) throw error
        setMessage({
          type: 'success',
          text: 'Sign-in link sent — click the link in your email to log in.',
        })
        return
      }

      if (isSignUp) {
        if (!password || password.length < 6) {
          setMessage({ type: 'error', text: 'Password must be at least 6 characters.' })
          setLoading(false)
          return
        }

        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/workspace`,
            data: {
              name: displayName.trim() || undefined,
              app_name: 'Lumina Tabula',
            },
          },
        })
        if (error) throw error

        if (data.session) {
          onSuccess()
        } else {
          setMessage({
            type: 'success',
            text: 'Account created! Check your inbox to confirm your email.',
          })
          setMode('signin')
        }
      } else {
        if (!password || password.length < 6) {
          setMessage({ type: 'error', text: 'Password must be at least 6 characters.' })
          setLoading(false)
          return
        }

        const { error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        })
        if (error) throw error
        onSuccess()
      }
    } catch (err: unknown) {
      setMessage({ type: 'error', text: describeAuthError(err) })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-v2-page">
      <Header
        variant="page"
        onSignIn={() => switchMode('signin')}
        onSignUp={() => switchMode('signup')}
      />

      <main className="auth-v2-main">
        <div className="auth-v2-grid-bg" aria-hidden="true" />

        <div className="auth-v2-card">
          <div className="auth-v2-head">
            <img src={logoUrl} alt="Lumina Tabula" className="auth-v2-logo" />
            <h1 className="auth-v2-title">
              {mode === 'update-password'
                ? 'Set new password'
                : mode === 'forgot-password'
                  ? 'Reset password'
                  : mode === 'magic-link'
                    ? 'Email sign-in link'
                    : isSignUp
                      ? 'Create your account'
                      : 'Welcome back'}
            </h1>
            <p className="auth-v2-sub">
              {mode === 'update-password'
                ? 'Choose a new password for your account.'
                : mode === 'forgot-password'
                  ? 'We will email you a link to reset your password.'
                  : mode === 'magic-link'
                    ? 'Sign in with a single click from your inbox.'
                    : isSignUp
                      ? '7-day free trial · No credit card required.'
                      : 'Sign in to continue to your workspace.'}
            </p>
          </div>

          {(mode === 'signin' || mode === 'signup') && (
            <div className="auth-v2-tabs" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={!isSignUp}
                className={`auth-v2-tab ${!isSignUp ? 'is-active' : ''}`}
                onClick={() => switchMode('signin')}
              >
                Sign in
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={isSignUp}
                className={`auth-v2-tab ${isSignUp ? 'is-active' : ''}`}
                onClick={() => switchMode('signup')}
              >
                Create account
              </button>
            </div>
          )}

          {(mode === 'signin' || mode === 'signup') &&
          providers &&
          (providers.google || providers.github) ? (
            <div className="auth-v2-social">
              {providers.google ? (
                <button
                  type="button"
                  className="auth-v2-social-btn"
                  onClick={() => handleOAuthSignIn('google')}
                  disabled={socialLoading !== null}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>{socialLoading === 'google' ? 'Connecting…' : 'Continue with Google'}</span>
                </button>
              ) : null}

              {providers.github ? (
                <button
                  type="button"
                  className="auth-v2-social-btn"
                  onClick={() => handleOAuthSignIn('github')}
                  disabled={socialLoading !== null}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                  </svg>
                  <span>{socialLoading === 'github' ? 'Connecting…' : 'Continue with GitHub'}</span>
                </button>
              ) : null}

              <div className="auth-v2-divider">
                <span>or with email</span>
              </div>
            </div>
          ) : null}

          {message && (
            <div className={`auth-v2-alert is-${message.type}`} role="alert">
              {message.type === 'error' ? <AlertIcon size={15} /> : <CheckIcon size={15} />}
              <span>{message.text}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="auth-v2-form">
            <input
              type="text"
              name="company_website"
              tabIndex={-1}
              autoComplete="off"
              style={{ display: 'none' }}
              value={honeypot}
              onChange={(e) => setHoneypot(e.target.value)}
              aria-hidden="true"
            />

            {isSignUp && (
              <div className="auth-v2-field">
                <label className="auth-v2-label" htmlFor="auth-name">
                  Full name
                </label>
                <input
                  id="auth-name"
                  type="text"
                  required={isSignUp}
                  className="auth-v2-input"
                  placeholder="Alex Morgan"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
              </div>
            )}

            {mode !== 'update-password' && (
              <div className="auth-v2-field">
                <label className="auth-v2-label" htmlFor="auth-email">
                  Email
                </label>
                <input
                  id="auth-email"
                  type="email"
                  required
                  autoComplete="email"
                  className="auth-v2-input"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            )}

            {mode !== 'forgot-password' && mode !== 'magic-link' && (
              <div className="auth-v2-field">
                <div className="auth-v2-label-row">
                  <label className="auth-v2-label" htmlFor="auth-password">
                    {mode === 'update-password' ? 'New password' : 'Password'}
                  </label>
                  {mode === 'signin' && (
                    <button
                      type="button"
                      className="auth-v2-link"
                      onClick={() => switchMode('forgot-password')}
                    >
                      Forgot?
                    </button>
                  )}
                </div>
                <div className="auth-v2-pwd-wrap">
                  <input
                    id="auth-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    autoComplete={
                      isSignUp || mode === 'update-password' ? 'new-password' : 'current-password'
                    }
                    className="auth-v2-input is-pwd"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    className="auth-v2-pwd-toggle"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOffIcon size={15} /> : <EyeIcon size={15} />}
                  </button>
                </div>
              </div>
            )}

            {mode === 'update-password' && (
              <div className="auth-v2-field">
                <label className="auth-v2-label" htmlFor="auth-confirm-password">
                  Confirm password
                </label>
                <div className="auth-v2-pwd-wrap">
                  <input
                    id="auth-confirm-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    autoComplete="new-password"
                    className="auth-v2-input"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>
              </div>
            )}

            <button type="submit" className="auth-v2-submit" disabled={loading}>
              {loading ? (
                <span className="auth-spinner" />
              ) : (
                <>
                  <span>
                    {mode === 'update-password'
                      ? 'Update password'
                      : mode === 'forgot-password'
                        ? 'Send reset link'
                        : mode === 'magic-link'
                          ? 'Send sign-in link'
                          : isSignUp
                            ? 'Create free account'
                            : 'Sign in'}
                  </span>
                  <ArrowRightIcon size={14} />
                </>
              )}
            </button>
          </form>

          <div className="auth-v2-aux">
            {mode === 'forgot-password' || mode === 'magic-link' || mode === 'update-password' ? (
              <button
                type="button"
                className="auth-v2-link"
                onClick={() => {
                  clearPasswordRecovery()
                  switchMode('signin')
                }}
              >
                ← Back to sign in
              </button>
            ) : !isSignUp ? (
              <button
                type="button"
                className="auth-v2-link"
                onClick={() => switchMode('magic-link')}
              >
                <LockIcon size={12} /> Email me a one-click sign-in link
              </button>
            ) : null}
          </div>

          <div className="auth-v2-foot">
            <ShieldCheckIcon size={13} />
            <span>Your files stay 100% on your device.</span>
          </div>
        </div>
      </main>
    </div>
  )
}
