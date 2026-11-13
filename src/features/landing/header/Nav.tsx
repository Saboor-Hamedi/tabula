import { useState } from 'react'
import { Link } from '../../../core/router'
import { ROUTES } from '../../../core/router/paths'
import {
  ArrowRightIcon,
  DatabaseIcon,
  MoonIcon,
  ShieldCheckIcon,
  SunIcon,
} from '../../common/Icons'
import { useTheme } from '../../common/useTheme'
import { Dropdown } from './Dropdown'
import { MENU } from './menu'

/**
 * The front page header.
 *
 * A privacy strip, the brand, a hover menu and the account actions. The menu
 * opens on hover and on keyboard focus, and only one panel is open at a time.
 */

export interface NavProps {
  isAuthenticated: boolean
  onSignIn?: () => void
  onSignUp?: () => void
  onOpenApp?: () => void
}

export function Nav({ isAuthenticated, onSignIn, onOpenApp }: NavProps) {
  const { theme, toggleTheme } = useTheme()
  const [openId, setOpenId] = useState<string | null>(null)

  return (
    <header className="landing-nav">
      <div className="landing-privacy-strip">
        <div className="landing-container landing-privacy-strip-inner">
          <span className="privacy-pill-icon">
            <ShieldCheckIcon size={13} />
          </span>
          <span className="privacy-strip-text">
            <strong>100% Private:</strong> Your files never leave your computer. Nothing is ever
            saved, uploaded, or tracked.
          </span>
        </div>
      </div>

      <div className="landing-nav-inner">
        <Link className="landing-brand" to={ROUTES.landing}>
          <span className="landing-logo-badge">
            <DatabaseIcon size={15} />
          </span>
          <span className="landing-brand-text">
            <span className="landing-brand-name">Lumina Tabula</span>
          </span>
        </Link>

        <nav className="landing-links" onMouseLeave={() => setOpenId(null)}>
          {MENU.map((entry) => (
            <Dropdown
              key={entry.id}
              entry={entry}
              open={openId === entry.id}
              onOpen={() => setOpenId(entry.id)}
              onClose={() => setOpenId((current) => (current === entry.id ? null : current))}
            />
          ))}
          <Link className="landing-link" to={ROUTES.insights}>
            Insights
          </Link>
        </nav>

        <div className="landing-nav-actions">
          <button
            type="button"
            className="landing-theme-btn"
            onClick={(event) => toggleTheme(event)}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {theme === 'dark' ? <SunIcon size={14} /> : <MoonIcon size={14} />}
          </button>

          {isAuthenticated ? (
            <button
              type="button"
              className="landing-btn landing-btn-primary"
              onClick={onOpenApp}
            >
              <span>Open workspace</span>
              <ArrowRightIcon size={13} />
            </button>
          ) : (
            <button
              type="button"
              className="landing-btn landing-btn-primary"
              onClick={onSignIn}
            >
              Sign In
            </button>
          )}
        </div>
      </div>
    </header>
  )
}
