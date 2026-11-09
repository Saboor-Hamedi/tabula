import { useState, type FormEvent } from 'react'
import { supabase } from '../../core/supabase/client'
import { CloseIcon } from '../common/Icons'
import { IconButton } from '../common/IconButton'
import { useAuth } from './useAuth'

interface AuthModalProps {
  open: boolean
  onClose: () => void
}

export function AuthModal({ open, onClose }: AuthModalProps) {
  const { user, profile, tier, isPro, signOut } = useAuth()
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null)

  if (!open) return null

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!supabase) return
    setLoading(true)
    setMessage(null)

    try {
      const cleanEmail = email.trim()
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            data: {
              name: displayName.trim() || undefined,
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
              {user ? 'Account & Subscription' : isSignUp ? 'Create your account' : 'Sign in to Tabula'}
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
                  <strong>You are on Tabula Pro</strong>
                  <p>Enjoy managed DeepSeek AI models, unlimited file size, and clean executive exports.</p>
                </div>
              ) : (
                <div className="auth-plan-free">
                  <div>
                    <strong>Upgrade to Tabula Pro</strong>
                    <p>Get managed AI without needing your own API key, unlimited analysis, and executive PDF reporting.</p>
                  </div>
                  <button
                    type="button"
                    className="btn btn-primary auth-upgrade-btn"
                    onClick={() => {
                      alert('Stripe Checkout will be connected to your Stripe account!')
                    }}
                  >
                    Upgrade ($19/mo)
                  </button>
                </div>
              )}
            </div>

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

            <div className="field">
              <label className="field-label" htmlFor="auth-password">
                Password
              </label>
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

            <button type="submit" className="btn btn-primary auth-submit-btn" disabled={loading}>
              {loading ? 'Please wait…' : isSignUp ? 'Create account' : 'Sign in'}
            </button>

            <div className="auth-toggle-mode">
              <span>{isSignUp ? 'Already have an account?' : "Don't have an account yet?"}</span>
              <button
                type="button"
                className="auth-link-btn"
                onClick={() => {
                  setIsSignUp(!isSignUp)
                  setMessage(null)
                }}
              >
                {isSignUp ? 'Sign in' : 'Create one'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
