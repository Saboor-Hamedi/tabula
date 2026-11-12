import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../../core/supabase/client'
import { useRouter } from '../../core/router'
import { ROUTES } from '../../core/router/paths'
import {
  AlertIcon,
  CheckIcon,
  DatabaseIcon,
  EyeIcon,
  EyeOffIcon,
  LockIcon,
  TableIcon,
  UserIcon,
} from '../common/Icons'
import { Header } from '../header/Header'
import {
  describeAuthError,
  fetchProviderAvailability,
  type OAuthProvider,
  type ProviderAvailability,
} from './providers'

type AuthMode = 'signin' | 'signup' | 'forgot-password' | 'magic-link'

interface AuthScreenProps {
  initialMode?: 'signin' | 'signup'
}

export function AuthScreen({ initialMode = 'signin' }: AuthScreenProps) {
  const { navigate } = useRouter()

  const onSuccess = () => navigate(ROUTES.workspace, { replace: true })
  const [mode, setMode] = useState<AuthMode>(initialMode)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [honeypot, setHoneypot] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [socialLoading, setSocialLoading] = useState<'google' | 'github' | null>(null)
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null)
  const [providers, setProviders] = useState<ProviderAvailability | null>(null)

  const isSignUp = mode === 'signup'

  // Ask the project which providers are enabled, so the screen only offers
  // the ones that can actually work.
  useEffect(() => {
    let active = true
    void fetchProviderAvailability().then((availability) => {
      if (active) setProviders(availability)
    })
    return () => {
      active = false
    }
  }, [])

  const handleOAuthSignIn = async (provider: OAuthProvider) => {
    if (!supabase) {
      setMessage({
        type: 'error',
        text: 'No project is configured, so social sign-in is unavailable.',
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

    // 4.5 Honeypot bot protection: ignore bot submissions
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
        text: 'Supabase client is not configured. Please check your environment variables.',
      })
      return
    }

    const cleanEmail = email.trim()
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setMessage({
        type: 'error',
        text: 'Please enter a valid email address.',
      })
      return
    }

    setLoading(true)
    setMessage(null)

    try {
      if (mode === 'forgot-password') {
        const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
          redirectTo: `${window.location.origin}/login`,
        })
        if (error) throw error
        setMessage({
          type: 'success',
          text: 'Password reset link sent! Check your email inbox to reset your password.',
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
          text: 'Magic sign-in link sent! Click the link in your email to log in instantly.',
        })
        return
      }

      if (isSignUp) {
        if (!password || password.length < 6) {
          setMessage({
            type: 'error',
            text: 'Password must be at least 6 characters long.',
          })
          setLoading(false)
          return
        }

        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            data: {
              name: displayName.trim() || undefined,
            },
          },
        })
        if (error) throw error

        if (data.session) {
          onSuccess()
        } else {
          setMessage({
            type: 'success',
            text: 'Account created! Please check your email inbox to confirm your registration.',
          })
          setMode('signin')
        }
      } else {
        if (!password || password.length < 6) {
          setMessage({
            type: 'error',
            text: 'Password must be at least 6 characters long.',
          })
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
      setMessage({
        type: 'error',
        text: describeAuthError(err),
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-screen">
      <Header
        variant="page"
        onSignIn={() => {
          setMode('signin')
          setMessage(null)
        }}
        onSignUp={() => {
          setMode('signup')
          setMessage(null)
        }}
      />

      <div className="auth-screen-container">
        {/* Left Side: Brand Story & Security Features */}
        <div className="auth-screen-hero">
          <div className="auth-hero-badge">
            <DatabaseIcon size={24} />
          </div>

          <h1 className="auth-hero-title">
            Tabula
            <span className="auth-hero-tag">Analytics</span>
          </h1>

          <p className="auth-hero-lead">
            The private, in-browser conversational data science workbench.
          </p>

          <div className="auth-feature-list">
            <div className="auth-feature-item">
              <div className="auth-feature-icon">
                <LockIcon size={16} />
              </div>
              <div className="auth-feature-text">
                <strong>100% Client-Side Privacy</strong>
                <span>
                  DuckDB WASM & Pyodide run on your CPU. Confidential spreadsheet data never touches a cloud server.
                </span>
              </div>
            </div>

            <div className="auth-feature-item">
              <div className="auth-feature-icon">
                <TableIcon size={16} />
              </div>
              <div className="auth-feature-text">
                <strong>Instant SQL & Python Plots</strong>
                <span>
                  Query millions of rows in milliseconds, generate publication charts, and model regressions.
                </span>
              </div>
            </div>

            <div className="auth-feature-item">
              <div className="auth-feature-icon">
                <CheckIcon size={16} />
              </div>
              <div className="auth-feature-text">
                <strong>Word & Docs Ready Exports</strong>
                <span>
                  1-click copy formatted tables directly to Microsoft Word or Google Docs, plus clean executive PDF reports.
                </span>
              </div>
            </div>
          </div>

          <div className="auth-hero-foot">
            <span>Serverless • Zero-knowledge data architecture • DuckDB WASM</span>
          </div>
        </div>

        {/* Right Side: High-polish Authentication Card */}
        <div className="auth-screen-card">
          <div className="auth-card-header">
            <h2>
              {mode === 'forgot-password'
                ? 'Reset your password'
                : mode === 'magic-link'
                ? 'Sign in with magic link'
                : isSignUp
                ? 'Create your account'
                : 'Sign in to Tabula'}
            </h2>
            <p>
              {mode === 'forgot-password'
                ? "Enter your email address and we'll send you a recovery link"
                : mode === 'magic-link'
                ? "We'll email you a one-click login link with no password needed"
                : isSignUp
                ? 'Get started with private, local-first dataset analysis'
                : 'Enter your credentials to access your workspace'}
            </p>
          </div>

          {/* Toggle between Sign In & Sign Up when in regular modes */}
          {(mode === 'signin' || mode === 'signup') && (
            <div className="auth-mode-switch" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={!isSignUp}
                className={`auth-mode-btn ${!isSignUp ? 'is-active' : ''}`}
                onClick={() => {
                  setMode('signin')
                  setMessage(null)
                }}
              >
                Sign In
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={isSignUp}
                className={`auth-mode-btn ${isSignUp ? 'is-active' : ''}`}
                onClick={() => {
                  setMode('signup')
                  setMessage(null)
                }}
              >
                Create Account
              </button>
            </div>
          )}

          {/* Social sign-in — only the providers the project has enabled */}
          {(mode === 'signin' || mode === 'signup') &&
          providers &&
          (providers.google || providers.github) ? (
            <div className="auth-social-group">
              {providers.google ? (
                <button
                  type="button"
                  className="auth-social-btn"
                  onClick={() => handleOAuthSignIn('google')}
                  disabled={socialLoading !== null}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24">
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
                  <span>
                    {socialLoading === 'google' ? 'Connecting…' : 'Continue with Google'}
                  </span>
                </button>
              ) : null}

              {providers.github ? (
                <button
                  type="button"
                  className="auth-social-btn"
                  onClick={() => handleOAuthSignIn('github')}
                  disabled={socialLoading !== null}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                  </svg>
                  <span>
                    {socialLoading === 'github' ? 'Connecting…' : 'Continue with GitHub'}
                  </span>
                </button>
              ) : null}

              <div className="auth-divider">
                <span>or continue with email</span>
              </div>
            </div>
          ) : null}

          {/* Error / Success Banner */}
          {message && (
            <div className={`auth-banner is-${message.type}`}>
              {message.type === 'error' ? <AlertIcon size={16} /> : <CheckIcon size={16} />}
              <span>{message.text}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="auth-screen-form">
            {/* Honeypot field for bot protection */}
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
              <div className="auth-input-group">
                <label className="auth-input-label" htmlFor="auth-name">
                  Full Name
                </label>
                <div className="auth-input-wrap">
                  <span className="auth-input-icon">
                    <UserIcon size={15} />
                  </span>
                  <input
                    id="auth-name"
                    type="text"
                    required={isSignUp}
                    className="auth-input"
                    placeholder="Alex Morgan"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                  />
                </div>
              </div>
            )}

            <div className="auth-input-group">
              <label className="auth-input-label" htmlFor="auth-email">
                Work Email
              </label>
              <div className="auth-input-wrap">
                <span className="auth-input-icon">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                    <polyline points="22,6 12,13 2,6" />
                  </svg>
                </span>
                <input
                  id="auth-email"
                  type="email"
                  required
                  autoComplete="email"
                  className="auth-input"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            {mode !== 'forgot-password' && mode !== 'magic-link' && (
              <div className="auth-input-group">
                <div className="auth-label-row">
                  <label className="auth-input-label" htmlFor="auth-password">
                    Password
                  </label>
                  {!isSignUp && (
                    <button
                      type="button"
                      className="auth-forgot-link"
                      onClick={() => {
                        setMode('forgot-password')
                        setMessage(null)
                      }}
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="auth-input-wrap">
                  <span className="auth-input-icon">
                    <LockIcon size={15} />
                  </span>
                  <input
                    id="auth-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    autoComplete={isSignUp ? 'new-password' : 'current-password'}
                    className="auth-input"
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    className="auth-show-pwd-btn"
                    onClick={() => setShowPassword(!showPassword)}
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOffIcon size={15} /> : <EyeIcon size={15} />}
                  </button>
                </div>
              </div>
            )}

            <button type="submit" className="auth-primary-submit" disabled={loading}>
              {loading ? (
                <span className="auth-spinner" />
              ) : mode === 'forgot-password' ? (
                'Send Password Reset Link'
              ) : mode === 'magic-link' ? (
                'Send Magic Sign-In Link'
              ) : isSignUp ? (
                'Create Account & Enter'
              ) : (
                'Sign In to Workspace'
              )}
            </button>
          </form>

          {/* Mode Switchers & Alternative Options */}
          <div className="auth-aux-links">
            {mode === 'forgot-password' || mode === 'magic-link' ? (
              <button
                type="button"
                className="auth-aux-btn"
                onClick={() => {
                  setMode('signin')
                  setMessage(null)
                }}
              >
                ← Back to Sign In
              </button>
            ) : !isSignUp ? (
              <button
                type="button"
                className="auth-aux-btn"
                onClick={() => {
                  setMode('magic-link')
                  setMessage(null)
                }}
              >
                Sign in with a password-free magic link →
              </button>
            ) : null}
          </div>

          <div className="auth-card-footer">
            <span>
              By signing in, you agree to local data processing terms. Tabula operates 100% on-device.
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
