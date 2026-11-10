import { useEffect, useState } from 'react'
import { AlertIcon, CheckIcon, DatabaseIcon, MoonIcon, SunIcon } from '../common/Icons'
import { useTheme } from '../common/useTheme'

export interface VerifyEmailScreenProps {
  email?: string
  onVerified: () => void
  onRefresh: () => Promise<unknown>
  onResend: () => Promise<{ error: Error | null }>
  onSignOut: () => Promise<void>
}

export function VerifyEmailScreen({
  email,
  onVerified,
  onRefresh,
  onResend,
  onSignOut,
}: VerifyEmailScreenProps) {
  const { theme, toggleTheme } = useTheme()
  const [cooldown, setCooldown] = useState(0)
  const [checking, setChecking] = useState(false)
  const [resending, setResending] = useState(false)
  const [status, setStatus] = useState<{ type: 'error' | 'success'; text: string } | null>(null)

  // Countdown timer for 60-second cooldown
  useEffect(() => {
    if (cooldown <= 0) return
    const timer = window.setInterval(() => {
      setCooldown((c) => (c <= 1 ? 0 : c - 1))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [cooldown])

  const handleCheckVerification = async () => {
    setChecking(true)
    setStatus(null)
    try {
      await onRefresh()
      // Call verified callback to let App.tsx re-evaluate
      onVerified()
    } catch {
      setStatus({
        type: 'error',
        text: 'Email not verified yet. Please check your inbox and click the verification link.',
      })
    } finally {
      setChecking(false)
    }
  }

  const handleResend = async () => {
    if (cooldown > 0 || resending) return
    setResending(true)
    setStatus(null)
    try {
      const { error } = await onResend()
      if (error) {
        setStatus({ type: 'error', text: error.message })
      } else {
        setStatus({
          type: 'success',
          text: 'A new verification link has been sent to your email address.',
        })
        setCooldown(60)
      }
    } catch {
      setStatus({
        type: 'error',
        text: 'Could not send verification email. Please try again later.',
      })
    } finally {
      setResending(false)
    }
  }

  return (
    <div className="auth-screen">
      <header className="auth-header">
        <div className="auth-header-left">
          <div className="auth-header-logo">
            <DatabaseIcon size={16} />
          </div>
          <span className="auth-header-brand">Tabula</span>
          <span className="auth-header-tag">Access Verification</span>
        </div>

        <div className="auth-header-right">
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

      <div className="auth-screen-container verify-screen-container">
        <div className="auth-screen-card verify-screen-card">
          <div className="verify-icon-wrap">
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="2" y="4" width="20" height="16" rx="2" />
              <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
            </svg>
          </div>

          <div className="auth-card-header">
            <h2>Check your inbox</h2>
            <p>
              We sent a verification link to <strong>{email || 'your email'}</strong>. Click the link to unlock your full private workspace.
            </p>
          </div>

          {status && (
            <div className={`auth-banner is-${status.type}`}>
              {status.type === 'error' ? <AlertIcon size={16} /> : <CheckIcon size={16} />}
              <span>{status.text}</span>
            </div>
          )}

          <div className="verify-actions">
            <button
              type="button"
              className="auth-primary-submit verify-continue-btn"
              onClick={handleCheckVerification}
              disabled={checking}
            >
              {checking ? (
                <span className="auth-spinner" />
              ) : (
                <>
                  <CheckIcon size={16} />
                  <span>I've verified — continue</span>
                </>
              )}
            </button>

            <button
              type="button"
              className="verify-resend-btn"
              onClick={handleResend}
              disabled={cooldown > 0 || resending}
            >
              {resending
                ? 'Sending email…'
                : cooldown > 0
                ? `Resend email in ${cooldown}s`
                : 'Resend verification email'}
            </button>
          </div>

          <div className="verify-footer-links">
            <button
              type="button"
              className="verify-switch-btn"
              onClick={() => void onSignOut()}
            >
              ← Use a different email
            </button>
            <span className="verify-help-text">
              Questions? Contact <a href="mailto:support@tabula.app">support@tabula.app</a>
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
