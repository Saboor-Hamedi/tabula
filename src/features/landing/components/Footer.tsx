import { Link } from '../../../core/router'
import { ROUTES } from '../../../core/router/paths'
import logoUrl from '../../../assets/logo.png'

/**
 * Editorial Footer with real multi-page router links.
 */

const FOOTER_PAGES: { label: string; to: string }[] = [
  { label: 'Home', to: ROUTES.home },
  { label: 'Features', to: ROUTES.features },
  { label: 'Sources', to: ROUTES.sources },
  { label: 'Pricing', to: ROUTES.pricing },
  { label: 'Posts', to: ROUTES.posts },
  { label: 'Workspace', to: ROUTES.workspace },
]

const PROMISES = ['100% On-Device', 'Zero Cloud Storage', 'No Telemetry', 'Never Saved']

export function Footer() {
  return (
    <footer className="landing-footer">
      <div className="landing-container">
        <div className="landing-footer-top">
          <div className="landing-footer-brand">
            <Link className="landing-brand" to={ROUTES.home} aria-label="Lumina Tabula home">
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
              <div className="col-title">Pages</div>
              {FOOTER_PAGES.map((page) => (
                <Link className="footer-link" to={page.to} key={page.to}>
                  {page.label}
                </Link>
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
