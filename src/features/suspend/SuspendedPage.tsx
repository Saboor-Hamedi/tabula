import { useEffect } from 'react'
import { useRouter } from '../../core/router'
import { ROUTES } from '../../core/router/paths'
import { signOutAccount } from '../../core/supabase/signOut'
import { useAuthLoading, useAuthUser, useProfile } from '../auth/useProfile'
import {
  ArrowRightIcon,
  DatabaseIcon,
  FileIcon,
  GlobeIcon,
  LockIcon,
  ZapIcon,
} from '../common/Icons'
import { Header } from '../header/Header'
import './suspend.css'

/**
 * Suspended Account Page (`/suspended`).
 *
 * Shown securely when a suspended member tries to access the workspace or
 * dashboard. Blocks AI/workspace access while allowing them to browse
 * published posts, open research sources, features, or sign out.
 */
export function SuspendedPage({ reasonOverride }: { reasonOverride?: string | null }) {
  const { navigate } = useRouter()
  const user = useAuthUser()
  const profile = useProfile()
  const loading = useAuthLoading()

  const suspendedEmail = (() => {
    try {
      return sessionStorage.getItem('tabula:suspended-notice')
    } catch {
      return null
    }
  })()

  const isSuspended = Boolean(profile?.is_suspended && profile.role !== 'admin')
  const hasSuspendedNotice = Boolean(suspendedEmail)
  const reason = reasonOverride ?? profile?.suspended_reason ?? null

  useEffect(() => {
    if (loading) return
    if (!isSuspended && !reasonOverride && !hasSuspendedNotice) {
      navigate(user ? ROUTES.workspace : ROUTES.home, { replace: true })
    }
  }, [loading, isSuspended, reasonOverride, hasSuspendedNotice, user, navigate])

  if (loading || (!isSuspended && !reasonOverride && !hasSuspendedNotice)) {
    return null
  }

  const handleSignOut = async () => {
    try {
      sessionStorage.removeItem('tabula:suspended-notice')
    } catch {
      // ignore
    }
    await signOutAccount()
    navigate(ROUTES.home, { replace: true })
  }

  const handleTryAnotherAccount = () => {
    try {
      sessionStorage.removeItem('tabula:suspended-notice')
    } catch {
      // ignore
    }
    navigate(ROUTES.signIn)
  }

  return (
    <div className="suspend-page">
      <Header variant="page" />

      <main className="suspend-main">
        <section className="suspend-card" aria-labelledby="suspend-page-title">
          <div className="suspend-badge">
            <LockIcon size={13} />
            <span>Account Suspended</span>
          </div>

          <header className="suspend-head">
            <h1 id="suspend-page-title" className="suspend-title">
              Your workspace access is suspended
            </h1>
            <p className="suspend-subtitle">
              An administrator has temporarily restricted AI analysis, dataset uploads, and
              dashboard access for this account. You can still read published research posts and
              explore public pages below.
            </p>
          </header>

          {reason ? (
            <div className="suspend-reason-box" role="status">
              <span className="suspend-reason-label">Suspension Reason</span>
              <p className="suspend-reason-text">{reason}</p>
            </div>
          ) : null}

          <div className="suspend-options-section">
            <h2 className="suspend-options-heading">Where you can go</h2>

            <div className="suspend-options-grid">
              <button
                type="button"
                className="suspend-option-card is-featured"
                onClick={() => navigate(ROUTES.posts)}
              >
                <div className="suspend-option-left">
                  <span className="suspend-option-icon">
                    <FileIcon size={16} />
                  </span>
                  <div className="suspend-option-copy">
                    <span className="suspend-option-title">Read Published Posts</span>
                    <span className="suspend-option-desc">
                      Browse public data stories, charts, and research articles
                    </span>
                  </div>
                </div>
                <ArrowRightIcon size={15} />
              </button>

              <button
                type="button"
                className="suspend-option-card"
                onClick={() => navigate(ROUTES.sources)}
              >
                <div className="suspend-option-left">
                  <span className="suspend-option-icon">
                    <DatabaseIcon size={15} />
                  </span>
                  <div className="suspend-option-copy">
                    <span className="suspend-option-title">Research Sources</span>
                    <span className="suspend-option-desc">Open public datasets</span>
                  </div>
                </div>
                <ArrowRightIcon size={14} />
              </button>

              <button
                type="button"
                className="suspend-option-card"
                onClick={() => navigate(ROUTES.features)}
              >
                <div className="suspend-option-left">
                  <span className="suspend-option-icon">
                    <ZapIcon size={15} />
                  </span>
                  <div className="suspend-option-copy">
                    <span className="suspend-option-title">Features</span>
                    <span className="suspend-option-desc">See how Tabula works</span>
                  </div>
                </div>
                <ArrowRightIcon size={14} />
              </button>

              <button
                type="button"
                className="suspend-option-card"
                onClick={() => navigate(ROUTES.home)}
              >
                <div className="suspend-option-left">
                  <span className="suspend-option-icon">
                    <GlobeIcon size={15} />
                  </span>
                  <div className="suspend-option-copy">
                    <span className="suspend-option-title">Home Page</span>
                    <span className="suspend-option-desc">Return to front page</span>
                  </div>
                </div>
                <ArrowRightIcon size={14} />
              </button>
            </div>
          </div>

          <footer className="suspend-foot">
            <span className="suspend-account-meta">
              {profile?.email || user?.email || suspendedEmail
                ? `Account: ${profile?.email ?? user?.email ?? suspendedEmail}`
                : 'Restricted account'}
            </span>
            {user ? (
              <button
                type="button"
                className="btn btn-secondary btn-small"
                onClick={() => void handleSignOut()}
              >
                Sign Out
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-secondary btn-small"
                onClick={handleTryAnotherAccount}
              >
                Sign In with Another Account
              </button>
            )}
          </footer>
        </section>
      </main>
    </div>
  )
}
