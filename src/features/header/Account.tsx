import { useEffect, useRef, useState } from 'react'
import { useProfile } from '../auth/useProfile'
import { CheckIcon, MoonIcon, SunIcon, UserIcon } from '../common/Icons'
import { useTheme } from '../common/useTheme'

/**
 * The account control.
 *
 * A signed-in member sees their name, and the account identifier that every
 * row they write is stamped with. A visitor sees the sign-in and sign-up
 * buttons. Nobody sees anything they cannot act on.
 */

export interface AccountProps {
  isAuthenticated?: boolean
  isAdmin?: boolean
  email?: string | null
  showWorkspaceLink?: boolean
  onSignIn?: () => void
  onSignUp?: () => void
  onSignOut?: () => void
  onOpenWorkspace?: () => void
}

export function Account({
  isAuthenticated = false,
  email = null,
  showWorkspaceLink = true,
  onSignIn,
  onSignOut,
  onOpenWorkspace,
}: AccountProps) {
  const profile = useProfile()
  const { theme, toggleTheme } = useTheme()
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handlePointerDown = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  if (!isAuthenticated) {
    return (
      <div className="header-account">
        <button
          type="button"
          className="header-login-btn"
          onClick={onSignIn}
          aria-label="Login"
          title="Login"
        >
          <UserIcon size={16} />
        </button>
      </div>
    )
  }

  const name = profile?.display_name ?? email ?? 'Member'
  const initial = name.trim().charAt(0).toUpperCase() || 'M'

  return (
    <div className="header-account" ref={menuRef}>
      <button
        type="button"
        className={`header-account-btn ${open ? 'is-open' : ''}`}
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        title={email ?? name}
      >
        {profile?.avatar_url ? (
          <img className="header-account-avatar" src={profile.avatar_url} alt="" />
        ) : (
          <span className="header-account-avatar is-fallback" aria-hidden>
            {initial}
          </span>
        )}
      </button>

      {open ? (
        <div className="header-account-menu" role="menu">
          <div className="header-account-menu-head">
            <span className="header-account-menu-name">{name}</span>
            {email ? <span className="header-account-menu-email">{email}</span> : null}
          </div>

          <div className="header-account-menu-divider" />

          {showWorkspaceLink ? (
            <button
              type="button"
              className="header-account-menu-item"
              role="menuitem"
              onClick={() => {
                setOpen(false)
                onOpenWorkspace?.()
              }}
            >
              <UserIcon size={13} />
              <span>Open workspace</span>
            </button>
          ) : null}
          <button
            type="button"
            className="header-account-menu-item"
            role="menuitem"
            onClick={(event) => {
              toggleTheme(event)
            }}
          >
            {theme === 'dark' ? <SunIcon size={13} /> : <MoonIcon size={13} />}
            <span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
          </button>
          <button
            type="button"
            className="header-account-menu-item is-danger"
            role="menuitem"
            onClick={() => {
              setOpen(false)
              onSignOut?.()
            }}
          >
            <CheckIcon size={13} />
            <span>Sign out</span>
          </button>
        </div>
      ) : null}
    </div>
  )
}
