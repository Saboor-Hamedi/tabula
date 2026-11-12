import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from '../../../core/router'
import { ArrowRightIcon } from '../../common/Icons'
import type { MenuEntry } from './menu'

/**
 * A hover dropdown.
 *
 * It opens on hover and on focus, so the keyboard reaches it too, and it
 * closes on Escape or when the pointer leaves the whole group. The panel
 * animates in from the top edge, which reads as "it belongs to the bar" rather
 * than "it appeared".
 */

export interface DropdownProps {
  entry: MenuEntry
  open: boolean
  onOpen: () => void
  onClose: () => void
}

export function Dropdown({ entry, open, onOpen, onClose }: DropdownProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState<string | null>(null)

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Escape' && open) {
        onClose()
      }
    },
    [open, onClose],
  )

  useEffect(() => {
    if (!open) return
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, handleKeyDown])

  return (
    <div
      className="nav-menu"
      ref={ref}
      onMouseEnter={onOpen}
      onMouseLeave={onClose}
      onFocus={onOpen}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) onClose()
      }}
    >
      <button
        type="button"
        className={`nav-menu-trigger ${open ? 'is-open' : ''}`}
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => (open ? onClose() : onOpen())}
      >
        <span>{entry.label}</span>
        <span className="nav-menu-caret" aria-hidden>
          <svg width="9" height="6" viewBox="0 0 10 6" fill="none">
            <path
              d="M1 1l4 4 4-4"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </button>

      <div
        className={`nav-dropdown ${open ? 'is-open' : ''}`}
        hidden={!open}
        role="region"
        aria-label={entry.label}
      >
        <div className="nav-dropdown-inner">
          <div className="nav-dropdown-columns">
            {entry.columns.map((column) => (
              <div className="nav-dropdown-column" key={column.title}>
                <span className="nav-dropdown-title">{column.title}</span>
                {column.links.map((link) => (
                  <Link
                    className={`nav-dropdown-link ${active === link.label ? 'is-active' : ''}`}
                    to={link.to}
                    key={link.label}
                    onMouseEnter={() => setActive(link.label)}
                    onMouseLeave={() => setActive(null)}
                    onFocus={() => setActive(link.label)}
                  >
                    <span className="nav-dropdown-link-label">{link.label}</span>
                    {link.description ? (
                      <span className="nav-dropdown-link-text">{link.description}</span>
                    ) : null}
                  </Link>
                ))}
              </div>
            ))}
          </div>

          {entry.featured ? (
            <Link className="nav-dropdown-featured" to={entry.featured.to}>
              <span className="nav-dropdown-featured-eyebrow">{entry.featured.eyebrow}</span>
              <span className="nav-dropdown-featured-title">{entry.featured.title}</span>
              <span className="nav-dropdown-featured-text">{entry.featured.text}</span>
              <span className="nav-dropdown-featured-cta">
                {entry.featured.cta}
                <ArrowRightIcon size={13} />
              </span>
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  )
}
