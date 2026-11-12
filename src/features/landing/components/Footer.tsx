import { Link } from '../../../core/router'
import { ROUTES } from '../../../core/router/paths'
import { DatabaseIcon, MoonIcon, SunIcon } from '../../common/Icons'
import { useTheme } from '../../common/useTheme'

/**
 * The footer.
 *
 * The navigation column scrolls to the section it names, so the links keep
 * working after the page becomes a set of routes.
 */

const SECTION_LINKS: { label: string; section: string }[] = [
  { label: 'Demo', section: 'demo' },
  { label: 'Privacy', section: 'privacy' },
  { label: 'Pricing', section: 'pricing' },
  { label: 'FAQ', section: 'faq' },
]

const PROMISES = ['100% On-Device', 'Zero Cloud Storage', 'No Telemetry', 'Never Saved']

export function Footer() {
  const { theme, toggleTheme } = useTheme()

  const scrollTo = (section: string) => {
    const element = document.getElementById(section)
    element?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <footer className="landing-footer">
      <div className="landing-container">
        <div className="landing-footer-top">
          <div className="landing-footer-brand">
            <Link className="landing-brand" to={ROUTES.landing}>
              <span className="landing-logo-badge">
                <DatabaseIcon size={14} />
              </span>
              <span className="landing-brand-name">Tabula</span>
            </Link>
            <p className="landing-footer-tagline">
              The private data analysis tool where files never leave your computer.
            </p>
          </div>

          <div className="landing-footer-cols">
            <div className="footer-col">
              <div className="col-title">Navigation</div>
              {SECTION_LINKS.map((link) => (
                <button
                  type="button"
                  onClick={() => scrollTo(link.section)}
                  className="footer-link"
                  key={link.label}
                >
                  {link.label}
                </button>
              ))}
            </div>

            <div className="footer-col">
              <div className="col-title">Privacy Promise</div>
              {PROMISES.map((promise) => (
                <span className="footer-static-item" key={promise}>
                  {promise}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="landing-footer-bottom">
          <div className="footer-copy">
            © {new Date().getFullYear()} Tabula. Your data stays with you.
          </div>
          <div className="footer-bottom-actions">
            <button
              type="button"
              className="landing-theme-btn"
              onClick={(event) => toggleTheme(event)}
              title="Toggle Dark/Light Mode"
            >
              {theme === 'dark' ? <SunIcon size={13} /> : <MoonIcon size={13} />}
              <span style={{ fontSize: '11px' }}>{theme === 'dark' ? 'Dark' : 'Light'}</span>
            </button>
          </div>
        </div>
      </div>
    </footer>
  )
}
