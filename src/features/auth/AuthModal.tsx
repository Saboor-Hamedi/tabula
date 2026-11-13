import { useState, type FormEvent } from 'react'
import { supabase } from '../../core/supabase/client'
import { openPricingModal, useUsageStatus } from '../../core/supabase/usage'
import { formatCount } from '../../core/utils/format'
import { CloseIcon } from '../common/Icons'
import { IconButton } from '../common/IconButton'
import { useAuth } from './useAuth'

interface AuthModalProps {
  open: boolean
  onClose: () => void
}

export function AuthModal({ open, onClose }: AuthModalProps) {
  const { user, profile, tier, isPro, signOut, resetPasswordForEmail } = useAuth()
  const { usage } = useUsageStatus()
  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot-password'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null)

  if (!open) return null

  const isSignUp = mode === 'signup'
  const isForgot = mode === 'forgot-password'

  const handleSignedInResetPassword = async () => {
    if (!user?.email) return
    setLoading(true)
    setMessage(null)
    const { error } = await resetPasswordForEmail(user.email)
    setLoading(false)
    if (error) {
      setMessage({ type: 'error', text: error.message })
    } else {
      setMessage({
        type: 'success',
        text: `Password reset link sent to ${user.email}. Check your inbox.`,
      })
    }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!supabase) return
    setLoading(true)
    setMessage(null)

    try {
      const cleanEmail = email.trim()
      if (isForgot) {
        const { error } = await resetPasswordForEmail(cleanEmail)
        if (error) throw error
        setMessage({
          type: 'success',
          text: 'Password reset link sent! Check your email inbox.',
        })
      } else if (isSignUp) {
        const { error } = await supabase.auth.signUp({
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
        setMessage({
          type: 'success',
          text: 'Check your email to confirm your account!',
        })
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        })
        if (error) throw error
        onClose()
      }
    } catch (err: unknown) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Authentication failed.',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="modal-card auth-modal-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Account & Subscription"
      >
        <header className="modal-header">
          <div>
            <h2 className="modal-title">
              {user
                ? 'Account & Subscription'
                : isForgot
                  ? 'Reset your password'
                  : isSignUp
                    ? 'Create your account'
                    : 'Sign in to Lumina Tabula'}
            </h2>
            <p className="modal-subtitle">
              {user
                ? 'Manage your plan, team features, and cloud workspace'
                : 'Unlock managed AI models, priority compute, and PDF exports'}
            </p>
          </div>
          <IconButton label="Close" onClick={onClose}>
            <CloseIcon size={16} />
          </IconButton>
        </header>

        {user ? (
          <div className="auth-user-view">
            <div className="auth-profile-box">
              <div className="auth-avatar">
                {profile?.display_name ? profile.display_name.charAt(0).toUpperCase() : user.email?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div className="auth-profile-details">
                <span className="auth-name">{profile?.display_name || user.email?.split('@')[0]}</span>
                <span className="auth-email">{user.email}</span>
              </div>
              <span className={`auth-tier-pill ${isPro ? 'is-pro' : 'is-free'}`}>
                {tier.toUpperCase()}
              </span>
            </div>

            <div className="auth-plan-banner">
              {isPro ? (
                <div className="auth-plan-pro">
                  <strong>You are on Lumina Tabula Pro</strong>
                  <p>
                    {usage
                      ? `${formatCount(usage.usedTokens)} / ${formatCount(usage.monthlyLimit ?? 5000000)} tokens used this month.`
                      : 'Enjoy managed DeepSeek AI models, unlimited file size, and clean executive exports.'}
                  </p>
                </div>
              ) : (
                <div className="auth-plan-free">
                  <div>
                    <strong>
                      {usage?.trialExpired
                        ? 'Your 7-day free trial has ended'
                        : `Free Trial (${usage?.trialDaysRemaining ?? 7} days left)`}
                    </strong>
                    <p>
                      {usage
                        ? `${formatCount(usage.usedTokens)} / ${formatCount(usage.monthlyLimit ?? 250000)} tokens spent this month.`
                        : 'Unlock Pro reasoning, unlimited datasets, and executive PDF reporting.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn btn-primary auth-upgrade-btn"
                    onClick={() => {
                      onClose()
                      openPricingModal(usage?.trialExpired ? 'trial-expired' : 'upgrade')
                    }}
                  >
                    Upgrade ($19/mo)
                  </button>
                </div>
              )}
            </div>

            {message ? (
              <div className={`auth-alert is-${message.type}`}>
                <span>{message.text}</span>
              </div>
            ) : null}

            <div className="auth-modal-footer">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  void signOut()
                  onClose()
                }}
              >
                Sign out
              </button>
              {user.email ? (
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={loading}
                  onClick={() => void handleSignedInResetPassword()}
                >
                  {loading ? 'Sending…' : 'Reset password'}
                </button>
              ) : null}
              <button type="button" className="btn btn-primary" onClick={onClose}>
                Done
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="auth-form">
            {message ? (
              <div className={`auth-alert is-${message.type}`}>
                <span>{message.text}</span>
              </div>
            ) : null}

            {isSignUp ? (
              <div className="field">
                <label className="field-label" htmlFor="auth-name">
                  Full Name
                </label>
                <input
                  id="auth-name"
                  type="text"
                  className="input"
                  placeholder="Alex Morgan"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
              </div>
            ) : null}

            <div className="field">
              <label className="field-label" htmlFor="auth-email">
                Email Address
              </label>
              <input
                id="auth-email"
                type="email"
                required
                className="input"
                placeholder="name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            {!isForgot ? (
              <div className="field">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label className="field-label" htmlFor="auth-password">
                    Password
                  </label>
                  {!isSignUp ? (
                    <button
                      type="button"
                      className="auth-link-btn"
                      onClick={() => {
                        setMode('forgot-password')
                        setMessage(null)
                      }}
                    >
                      Forgot password?
                    </button>
                  ) : null}
                </div>
                <input
                  id="auth-password"
                  type="password"
                  required
                  minLength={6}
                  className="input"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            ) : null}

            <button type="submit" className="btn btn-primary auth-submit-btn" disabled={loading}>
              {loading
                ? 'Please wait…'
                : isForgot
                  ? 'Send reset link'
                  : isSignUp
                    ? 'Create account'
                    : 'Sign in'}
            </button>

            <div className="auth-toggle-mode">
              <span>
                {isForgot
                  ? 'Remembered your password?'
                  : isSignUp
                    ? 'Already have an account?'
                    : "Don't have an account yet?"}
              </span>
              <button
                type="button"
                className="auth-link-btn"
                onClick={() => {
                  setMode(isForgot ? 'signin' : isSignUp ? 'signin' : 'signup')
                  setMessage(null)
                }}
              >
                {isForgot ? 'Sign in' : isSignUp ? 'Sign in' : 'Create one'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
