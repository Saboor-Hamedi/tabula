import { useState, type FormEvent } from 'react'
import { supabase } from '../../core/supabase/client'
import {
  AlertIcon,
  CheckIcon,
  DatabaseIcon,
  EyeIcon,
  EyeOffIcon,
  LockIcon,
  MoonIcon,
  SunIcon,
  TableIcon,
  UserIcon,
} from '../common/Icons'
import { useTheme } from '../common/useTheme'

interface AuthScreenProps {
  onSuccess?: () => void
  onBackToHome?: () => void
  initialMode?: 'signin' | 'signup'
}

export function AuthScreen({ onSuccess, onBackToHome, initialMode = 'signin' }: AuthScreenProps) {
  const { theme, toggleTheme } = useTheme()
  const [isSignUp, setIsSignUp] = useState(initialMode === 'signup')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
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

    if (!password || password.length < 6) {
      setMessage({
        type: 'error',
        text: 'Password must be at least 6 characters long.',
      })
      return
    }

    setLoading(true)
    setMessage(null)

    try {
      if (isSignUp) {
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
          onSuccess?.()
        } else {
          setMessage({
            type: 'success',
            text: 'Account created! Please check your email inbox to confirm your registration, then sign in.',
          })
          setIsSignUp(false)
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        })
        if (error) throw error
        onSuccess?.()
      }
    } catch (err: unknown) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Authentication failed. Please verify your credentials.',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-screen">
      {/* Real Full-Width App Header on Login Page */}
      <header className="auth-header">
        <div className="auth-header-left" onClick={onBackToHome} style={{ cursor: onBackToHome ? 'pointer' : 'default' }}>
          <div className="auth-header-logo">
            <DatabaseIcon size={16} />
          </div>
          <span className="auth-header-brand">Tabula</span>
          <span className="auth-header-tag">Secure Gateway</span>
        </div>

        <div className="auth-header-right">
          {onBackToHome && (
            <button
              type="button"
              className="auth-header-link-btn"
              onClick={onBackToHome}
              title="Return to Product Tour & Overview"
            >
              ← Back to Product Tour
            </button>
          )}
          <button
            type="button"
            className="auth-theme-toggle"
            onClick={(e) => toggleTheme(e)}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {theme === 'dark' ? <SunIcon size={15} /> : <MoonIcon size={15} />}
          </button>
        </div>
      </header>

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
            <h2>{isSignUp ? 'Create your account' : 'Sign in to Tabula'}</h2>
            <p>
              {isSignUp
                ? 'Get started with private, local-first dataset analysis'
                : 'Enter your credentials to access your workspace'}
            </p>
          </div>

          {/* Toggle between Sign In & Sign Up */}
          <div className="auth-mode-switch" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={!isSignUp}
              className={`auth-mode-btn ${!isSignUp ? 'is-active' : ''}`}
              onClick={() => {
                setIsSignUp(false)
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
                setIsSignUp(true)
                setMessage(null)
              }}
            >
              Create Account
            </button>
          </div>

          {/* Error / Success Banner */}
          {message && (
            <div className={`auth-banner is-${message.type}`}>
              {message.type === 'error' ? <AlertIcon size={16} /> : <CheckIcon size={16} />}
              <span>{message.text}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="auth-screen-form">
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

            <div className="auth-input-group">
              <label className="auth-input-label" htmlFor="auth-password">
                Password
              </label>
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

            <button type="submit" className="auth-primary-submit" disabled={loading}>
              {loading ? (
                <span className="auth-spinner" />
              ) : isSignUp ? (
                'Create Account & Enter'
              ) : (
                'Sign In to Workspace'
              )}
            </button>
          </form>

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
