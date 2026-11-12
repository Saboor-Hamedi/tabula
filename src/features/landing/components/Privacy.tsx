import { ShieldCheckIcon } from '../../common/Icons'

/**
 * The privacy guarantee.
 *
 * The comparison is the argument: a side that uploads, and a side that does
 * not. The icons are the only decoration on the page.
 */

export function Privacy() {
  return (
<section id="privacy" className="landing-section landing-architecture-section">
        <div className="landing-container">
          <div className="landing-section-header">
            <span className="landing-subhead">Privacy Guarantee</span>
            <h2 className="landing-section-title">Your Data Stays With You. Period.</h2>
            <p className="landing-section-desc">
              We engineered Tabula so that it is physically impossible for us to save, access, or lose your data.
            </p>
          </div>

          <div className="landing-architecture-grid">
            <div className="landing-arch-card arch-legacy">
              <div className="landing-arch-badge badge-warning">Standard Cloud Tools</div>
              <h3 className="landing-arch-title">How Traditional Software Works</h3>
              <ul className="landing-arch-list">
                <li>
                  <span className="arch-cross">✕</span> Your confidential spreadsheets are uploaded over the internet
                </li>
                <li>
                  <span className="arch-cross">✕</span> Data is stored on third-party servers and cloud disks
                </li>
                <li>
                  <span className="arch-cross">✕</span> Risk of data breaches, accidental leaks, and employee access
                </li>
                <li>
                  <span className="arch-cross">✕</span> Requires complex legal agreements and security sign-offs
                </li>
              </ul>
            </div>

            <div className="landing-arch-card arch-tabula">
              <div className="landing-arch-badge badge-success">
                <ShieldCheckIcon size={13} /> The Tabula Guarantee
              </div>
              <h3 className="landing-arch-title">Total Local Privacy</h3>
              <ul className="landing-arch-list">
                <li>
                  <span className="arch-check">✓</span> <strong>0 bytes uploaded:</strong> Files open strictly inside your browser
                </li>
                <li>
                  <span className="arch-check">✓</span> <strong>Never saved:</strong> When you close the tab, data vanishes from memory
                </li>
                <li>
                  <span className="arch-check">✓</span> <strong>Never stolen:</strong> No server has access to your rows or numbers
                </li>
                <li>
                  <span className="arch-check">✓</span> <strong>Full compliance:</strong> Safe for financial and medical records
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>
  )
}
