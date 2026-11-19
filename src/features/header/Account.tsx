import { useEffect, useRef, useState } from 'react'
import { useRouter } from '../../core/router'
import { ROUTES, userPath } from '../../core/router/paths'
import { useAuthUser, useProfile, useUserSlug } from '../auth/useProfile'
import {
  ActivityIcon,
  ArrowRightIcon,
  CheckIcon,
  DatabaseIcon,
  FileIcon,
  GlobeIcon,
  MoonIcon,
  SettingsIcon,
  SparklesIcon,
  SunIcon,
  UserIcon,
} from '../common/Icons'
import { useTheme } from '../common/useTheme'
import { NAV_PAGES } from './Nav'

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

function renderNavIcon(to: string) {
  if (to === ROUTES.home) return <GlobeIcon size={13} />
  if (to === ROUTES.features) return <SparklesIcon size={13} />
  if (to === ROUTES.sources) return <DatabaseIcon size={13} />
  if (to === ROUTES.pricing) return <ActivityIcon size={13} />
  return <FileIcon size={13} />
}

export function Account({
  isAuthenticated = false,
  email = null,
  showWorkspaceLink = true,
  onSignIn,
  onSignUp,
  onSignOut,
  onOpenWorkspace,
}: AccountProps) {
  const { path, navigate } = useRouter()
  const profile = useProfile()
  const user = useAuthUser()
  const userSlug = useUserSlug()
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

  const name = isAuthenticated
    ? (profile?.display_name ??
        (user?.user_metadata?.full_name as string | undefined) ??
        (user?.user_metadata?.name as string | undefined) ??
        email ??
        'Member')
    : 'Guest'
  const initial = name.trim().charAt(0).toUpperCase() || 'M'
  const avatarUrl = isAuthenticated
    ? (profile?.avatar_url ?? (user?.user_metadata?.avatar_url as string | undefined) ?? null)
    : null

  return (
    <div className="header-account" ref={menuRef}>
      <button
        type="button"
        className={`header-account-btn ${open ? 'is-open' : ''}`}
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={isAuthenticated ? 'Account & navigation menu' : 'Navigation & sign in menu'}
        title={isAuthenticated ? (email ?? name) : 'Menu & Sign in'}
      >
        {isAuthenticated ? (
          avatarUrl ? (
            <img className="header-account-avatar" src={avatarUrl} alt="" />
          ) : (
            <span className="header-account-avatar is-fallback" aria-hidden>
              {initial}
            </span>
          )
        ) : (
          <span className="header-account-avatar is-fallback" aria-hidden>
            <UserIcon size={15} />
          </span>
        )}
      </button>

      {open ? (
        <div className="header-account-menu" role="menu">
          {/* Top Identity Header */}
          <div className="header-account-menu-head">
            <div className="header-account-menu-avatar-wrap" aria-hidden>
              {isAuthenticated && avatarUrl ? (
                <img className="header-account-menu-avatar" src={avatarUrl} alt="" />
              ) : (
                <span className="header-account-menu-avatar is-fallback">
                  {isAuthenticated ? initial : <UserIcon size={15} />}
                </span>
              )}
            </div>
            <div className="header-account-menu-id-copy-wrap">
              <span className="header-account-menu-name">
                {isAuthenticated ? name : 'Welcome to Tabula'}
              </span>
              <span className="header-account-menu-email">
                {isAuthenticated
                  ? (email ?? 'Signed in')
                  : 'Local-first SQL & AI workspace'}
              </span>
            </div>
          </div>

          {/* Mobile / Small-Screen Navigation Section */}
          {showWorkspaceLink ? (
            <div className="header-account-mobile-nav">
              <div className="header-account-menu-divider" />
              <div className="header-account-menu-section-label">Navigate</div>
              {NAV_PAGES.map((item) => {
                const active = item.match(path)
                return (
                  <button
                    key={item.to}
                    type="button"
                    role="menuitem"
                    aria-current={active ? 'page' : undefined}
                    className={`header-account-menu-item header-account-nav-item ${
                      active ? 'is-active' : ''
                    }`}
                    onClick={() => {
                      setOpen(false)
                      navigate(item.to)
                    }}
                  >
                    <span className="header-account-item-left">
                      {renderNavIcon(item.to)}
                      <span>{item.label}</span>
                    </span>
                    {active ? <span className="header-account-active-dot" aria-hidden /> : null}
                  </button>
                )
              })}
            </div>
          ) : null}

          <div className="header-account-menu-divider" />

          {/* Workspace & Dashboard */}
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
              <span className="header-account-item-left">
                <ArrowRightIcon size={13} />
                <span>Open workspace</span>
              </span>
            </button>
          ) : null}

          {isAuthenticated && showWorkspaceLink ? (
            <button
              type="button"
              className="header-account-menu-item"
              role="menuitem"
              onClick={() => {
                setOpen(false)
                navigate(userPath('/app', userSlug))
              }}
            >
              <span className="header-account-item-left">
                <SettingsIcon size={13} />
                <span>Dashboard</span>
              </span>
            </button>
          ) : null}

          {/* Theme Switcher */}
          <button
            type="button"
            className="header-account-menu-item"
            role="menuitem"
            onClick={(event) => {
              toggleTheme(event)
            }}
          >
            <span className="header-account-item-left">
              {theme === 'dark' ? <SunIcon size={13} /> : <MoonIcon size={13} />}
              <span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
            </span>
          </button>

          <div className="header-account-menu-divider" />

          {/* Auth Actions */}
          {isAuthenticated ? (
            <button
              type="button"
              className="header-account-menu-item is-danger"
              role="menuitem"
              onClick={() => {
                setOpen(false)
                onSignOut?.()
              }}
            >
              <span className="header-account-item-left">
                <CheckIcon size={13} />
                <span>Sign out</span>
              </span>
            </button>
          ) : (
            <>
              <button
                type="button"
                className="header-account-menu-item is-primary-item"
                role="menuitem"
                onClick={() => {
                  setOpen(false)
                  onSignIn?.()
                }}
              >
                <span className="header-account-item-left">
                  <UserIcon size={13} />
                  <span>Sign in</span>
                </span>
              </button>
              {onSignUp ? (
                <button
                  type="button"
                  className="header-account-menu-item"
                  role="menuitem"
                  onClick={() => {
                    setOpen(false)
                    onSignUp()
                  }}
                >
                  <span className="header-account-item-left">
                    <SparklesIcon size={13} />
                    <span>Create account</span>
                  </span>
                </button>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </div>
  )
}
