import { useEffect, useRef, useState } from 'react'
import { NEEDS_ACCESS_KEY } from '../../core/config'
import { SettingsIcon, UserIcon } from '../common/Icons'
import { useSessionActions, useSessionState } from '../SessionProvider'
import { useAuth } from '../auth/useAuth'

/**
 * Sidebar footer.
 *
 * Houses Settings and the Account & Subscription popover menu.
 * Robust on-device dropdown that opens upward without breaking modals.
 */

export function SidebarFooter() {
  const { apiKey } = useSessionState()
  const { openSettings } = useSessionActions()
  const { user, profile, isPro, isConfigured, signOut } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [menuOpen])

  const initial = profile?.display_name
    ? profile.display_name.charAt(0).toUpperCase()
    : user?.email?.charAt(0).toUpperCase() || 'U'

  return (
    <div className="sidebar-footer" ref={menuRef}>
      {/* Account Popover Menu */}
      {menuOpen && (
        <div className="sidebar-account-menu" role="menu">
          <div className="account-menu-header">
            <div className="account-menu-avatar">{initial}</div>
            <div className="account-menu-user-info">
              <span className="account-menu-name">
                {profile?.display_name || user?.email?.split('@')[0] || 'User'}
              </span>
              <span className="account-menu-email">{user?.email || 'Local User'}</span>
            </div>
            <span className={`account-menu-tier-pill ${isPro ? 'is-pro' : 'is-free'}`}>
              {isPro ? 'PRO' : 'FREE'}
            </span>
          </div>

          <div className="account-menu-divider" />

          <button
            type="button"
            className="account-menu-item"
            onClick={() => {
              setMenuOpen(false)
              window.location.hash = '#landing'
            }}
          >
            <span>{isPro ? 'View Subscription Plans' : 'Upgrade to Pro ($19/mo)'}</span>
          </button>

          <button
            type="button"
            className="account-menu-item"
            onClick={() => {
              setMenuOpen(false)
              openSettings()
            }}
          >
            <span>Workspace Settings</span>
          </button>

          {user && (
            <>
              <div className="account-menu-divider" />
              <button
                type="button"
                className="account-menu-item is-danger"
                onClick={() => {
                  setMenuOpen(false)
                  void signOut()
                }}
              >
                <span>Sign out</span>
              </button>
            </>
          )}
        </div>
      )}

      {/* Account Button */}
      {isConfigured && user ? (
        <button
          type="button"
          className={`sidebar-account-btn ${menuOpen ? 'is-active' : ''}`}
          onClick={() => setMenuOpen(!menuOpen)}
          title={`Account: ${user.email} (${isPro ? 'Pro' : 'Free'})`}
          aria-expanded={menuOpen}
        >
          <span className="sidebar-account-avatar">{initial}</span>
          <span className="sidebar-account-name">
            {profile?.display_name || user.email?.split('@')[0]}
          </span>
          <span className={`sidebar-account-badge ${isPro ? 'is-pro' : 'is-free'}`}>
            {isPro ? 'PRO' : 'FREE'}
          </span>
        </button>
      ) : (
        <button
          type="button"
          className="sidebar-account-btn"
          onClick={() => {
            window.location.hash = '#landing'
          }}
          title="Sign in or view plans"
        >
          <span className="sidebar-account-avatar">
            <UserIcon size={12} />
          </span>
          <span className="sidebar-account-name">Guest</span>
          <span className="sidebar-account-badge is-free">FREE</span>
        </button>
      )}

      {/* Settings Button */}
      <button
        type="button"
        className="sidebar-settings-btn"
        onClick={openSettings}
        title="Settings"
      >
        <SettingsIcon size={15} />
        {NEEDS_ACCESS_KEY && !apiKey ? (
          <span className="sidebar-dot" aria-label="Access key required" />
        ) : null}
      </button>
    </div>
  )
}
