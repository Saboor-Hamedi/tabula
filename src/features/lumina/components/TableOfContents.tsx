import { useEffect, useState } from 'react'
import type { DocHeading } from './Markdown'

export function TableOfContents({ headings }: { headings: DocHeading[] }) {
  const [activeId, setActiveId] = useState<string>(headings[0]?.id ?? '')

  useEffect(() => {
    setActiveId(headings[0]?.id ?? '')
    if (headings.length === 0) return

    const handleScroll = () => {
      const offset = 108
      let current = headings[0]?.id ?? ''
      for (const h of headings) {
        const el = document.getElementById(h.id)
        if (el) {
          const rect = el.getBoundingClientRect()
          if (rect.top <= offset) {
            current = h.id
          }
        }
      }
      setActiveId(current)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [headings])

  if (headings.length === 0) return null

  return (
    <aside className="lumina-toc" aria-label="On this page">
      <div className="lumina-toc-sticky">
        <div className="lumina-toc-title">On this page</div>
        <ul className="lumina-toc-list">
          {headings.map((h) => (
            <li
              key={h.id}
              className={`lumina-toc-item is-level-${h.level} ${
                activeId === h.id ? 'is-active' : ''
              }`}
            >
              <a
                href={`#${h.id}`}
                onClick={(e) => {
                  e.preventDefault()
                  const target = document.getElementById(h.id)
                  if (target) {
                    target.scrollIntoView({ behavior: 'smooth', block: 'start' })
                    setActiveId(h.id)
                  }
                }}
              >
                {h.text}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  )
}

export function MobileInlineToc({ headings }: { headings: DocHeading[] }) {
  const [open, setOpen] = useState(false)
  if (headings.length === 0) return null

  return (
    <div className="lumina-mobile-toc">
      <button
        type="button"
        className="lumina-mobile-toc-btn"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span>On this page ({headings.length})</span>
        <span className={`lumina-nav-chevron ${open ? '' : 'is-collapsed'}`}>▾</span>
      </button>
      {open ? (
        <ul className="lumina-mobile-toc-list">
          {headings.map((h) => (
            <li key={h.id} className={`is-level-${h.level}`}>
              <a
                href={`#${h.id}`}
                onClick={(e) => {
                  e.preventDefault()
                  setOpen(false)
                  const target = document.getElementById(h.id)
                  if (target) {
                    target.scrollIntoView({ behavior: 'smooth', block: 'start' })
                  }
                }}
              >
                {h.text}
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
