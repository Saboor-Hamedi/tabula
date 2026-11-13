import { useEffect, useRef, useState } from 'react'
import { useRouter } from '../../core/router'
import { ROUTES, userPath } from '../../core/router/paths'
import { signOutAccount } from '../../core/supabase/signOut'
import { useUsageStatus } from '../../core/supabase/usage'
import { SettingsIcon, UserIcon } from '../common/Icons'
import { useSessionActions } from '../SessionProvider'
import { useAuthUser, useIsAdmin, useProfile, useUserSlug } from '../auth/useProfile'
import { UsageQuotaCard } from '../billing/UsageQuotaCard'

/**
 * Sidebar footer.
 *
 * Shows the user account menu (plus Dashboard link for administrators and Sign out),
 * and the Settings button for administrators only.
 */
export function SidebarFooter() {
  const { openSettings } = useSessionActions()
  const { navigate } = useRouter()
  const user = useAuthUser()
  const profile = useProfile()
  const isAdmin = useIsAdmin()
  const userSlug = useUserSlug()
  const { usage } = useUsageStatus()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [menuOpen])

  const email = user?.email ?? profile?.email ?? ''
  const displayName = profile?.display_name || email.split('@')[0] || 'User'
  const initial = displayName.trim().charAt(0).toUpperCase() || 'U'
  const avatarUrl = profile?.avatar_url ?? null
  const tierText = usage?.isAdmin
    ? 'Admin'
    : usage?.tier === 'pro'
      ? 'Plus'
      : usage?.tier === 'enterprise'
        ? 'Enterprise'
        : usage?.trialExpired
          ? 'Trial Ended'
          : 'Trial'
  const isPaidTier = Boolean(
    usage?.isAdmin ||
      usage?.tier === 'pro' ||
      usage?.tier === 'enterprise',
  )

  return (
    <>
      <div className="sidebar-footer" ref={menuRef}>
      {menuOpen && user ? (
        <div className="sidebar-account-menu" role="menu">
          <div className="account-menu-header">
            <div className="account-menu-avatar">
              {avatarUrl ? (
                <img src={avatarUrl} alt={displayName} className="sidebar-account-avatar-img" />
              ) : (
                initial
              )}
            </div>
            <div className="account-menu-user-info">
              <span className="account-menu-name">{displayName}</span>
              <span className="account-menu-email">{email}</span>
            </div>
            {isAdmin ? <span className="sidebar-account-badge is-pro">Admin</span> : null}
          </div>

          <UsageQuotaCard />

          <div className="account-menu-divider" />

          <button
            type="button"
            className="account-menu-item"
            role="menuitem"
            onClick={() => {
              setMenuOpen(false)
              navigate(userPath('/app', userSlug))
            }}
          >
            <span>Dashboard & Quota</span>
          </button>

          <button
            type="button"
            className="account-menu-item is-danger"
            role="menuitem"
            onClick={() => {
              setMenuOpen(false)
              void signOutAccount()
            }}
          >
            <span>Sign out</span>
          </button>
        </div>
      ) : null}

      {user ? (
        <div className="sidebar-account-block">
          <button
            type="button"
            className={`sidebar-account-btn ${menuOpen ? 'is-active' : ''}`}
            onClick={() => setMenuOpen(!menuOpen)}
            title={`${displayName} (${user.email})`}
            aria-label={`Account menu for ${displayName}`}
            aria-expanded={menuOpen}
          >
            <span className="sidebar-account-avatar">
              {avatarUrl ? (
                <img src={avatarUrl} alt={displayName} className="sidebar-account-avatar-img" />
              ) : (
                initial
              )}
            </span>
            <span className="sidebar-account-name">{email || displayName}</span>
            {usage ? (
              <span className={`account-menu-tier-pill ${isPaidTier ? 'is-pro' : 'is-free'}`}>
                {tierText}
              </span>
            ) : null}
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="sidebar-account-btn"
          onClick={() => navigate(ROUTES.signIn)}
          title="Sign in"
        >
          <span className="sidebar-account-avatar">
            <UserIcon size={12} />
          </span>
          <span className="sidebar-account-name">Guest</span>
        </button>
      )}

      {isAdmin ? (
        <button
          type="button"
          className="sidebar-settings-btn"
          onClick={openSettings}
          title="Settings"
        >
          <SettingsIcon size={15} />
        </button>
      ) : null}
      </div>
    </>
  )
}
