import { Link } from '../../../core/router'
import { ROUTES } from '../../../core/router/paths'
import logoUrl from '../../../assets/logo.png'

/**
 * Editorial Footer.
 */

const SECTION_LINKS: { label: string; section: string }[] = [
  { label: 'Showcase', section: 'demo' },
  { label: 'Privacy', section: 'privacy' },
  { label: 'Capabilities', section: 'features' },
  { label: 'Pricing', section: 'pricing' },
  { label: 'FAQ', section: 'faq' },
]

const PROMISES = ['100% On-Device', 'Zero Cloud Storage', 'No Telemetry', 'Never Saved']

export function Footer() {
  const scrollTo = (section: string) => {
    const element = document.getElementById(section)
    element?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <footer className="landing-footer">
      <div className="landing-container">
        <div className="landing-footer-top">
          <div className="landing-footer-brand">
            <Link className="landing-brand" to={ROUTES.landing} aria-label="Lumina Tabula home">
              <img src={logoUrl} alt="" className="landing-brand-logo" />
              <span className="landing-brand-name">Lumina Tabula</span>
            </Link>
            <p className="landing-footer-tagline">
              Private spreadsheet analysis where your Excel and CSV files never leave your
              computer.
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
              <Link className="footer-link" to={ROUTES.posts}>
                Published Stories
              </Link>
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
            © {new Date().getFullYear()} Lumina Tabula. Your data stays with you.
          </div>
          <div className="footer-status">
            <span className="footer-status-dot" aria-hidden="true" />
            <span>100% Private · Runs on your device</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
