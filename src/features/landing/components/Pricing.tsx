import { CheckIcon } from '../../common/Icons'

/**
 * Pricing.
 *
 * Monthly plans only.
 */

export interface PricingProps {
  isAuthenticated: boolean
  onNavigateToAuth: (mode?: 'signin' | 'signup') => void
  onNavigateToApp: () => void
}

export function Pricing({
  isAuthenticated,
  onNavigateToAuth,
  onNavigateToApp,
}: PricingProps) {
  return (
<section id="pricing" className="landing-section landing-pricing-section">
        <div className="landing-container">
          <div className="landing-section-header">
            <span className="landing-subhead">Simple Pricing</span>
            <h2 className="landing-section-title">Affordable Monthly Plans</h2>
            <p className="landing-section-desc">
              No hidden fees, no complicated tiers, and no per-query charges.
            </p>
          </div>

          <div className="landing-pricing-grid-two">
            {/* 7-Day Free Trial */}
            <div className="landing-pricing-card">
              <div className="card-top">
                <h3 className="plan-name">7-Day Free Trial</h3>
                <p className="plan-desc">Try Lumina Tabula with full access — no card required.</p>
                <div className="plan-price">
                  <span className="price-amount">$0</span>
                  <span className="price-period">/ 7 days</span>
                </div>
              </div>
              <ul className="plan-features">
                <li>
                  <CheckIcon size={14} /> Full workspace access for 7 days on signup
                </li>
                <li>
                  <CheckIcon size={14} /> No bank account or credit card required
                </li>
                <li>
                  <CheckIcon size={14} /> 250,000 AI tokens included during trial
                </li>
                <li>
                  <CheckIcon size={14} /> Instant calculations, SQL & Python charts
                </li>
                <li>
                  <CheckIcon size={14} /> 100% private — raw files stay in your browser
                </li>
              </ul>
              <button
                type="button"
                className="plan-cta-btn btn-outline"
                onClick={() => (isAuthenticated ? onNavigateToApp() : onNavigateToAuth('signup'))}
              >
                {isAuthenticated ? 'Open Workspace' : 'Start 7-Day Free Trial'}
              </button>
            </div>

            {/* Pro Analyst */}
            <div className="landing-pricing-card card-featured">
              <div className="featured-pill">Most Popular</div>
              <div className="card-top">
                <h3 className="plan-name">Pro Analyst</h3>
                <p className="plan-desc">For professionals, managers, and consultants.</p>
                <div className="plan-price">
                  <span className="price-amount">$19</span>
                  <span className="price-period">/ month</span>
                </div>
              </div>
              <ul className="plan-features">
                <li>
                  <CheckIcon size={14} /> <strong>All Free features included</strong>
                </li>
                <li>
                  <CheckIcon size={14} /> Unlimited rows & massive spreadsheet files
                </li>
                <li>
                  <CheckIcon size={14} /> Automated executive summaries & insights
                </li>
                <li>
                  <CheckIcon size={14} /> PDF report downloads
                </li>
                <li>
                  <CheckIcon size={14} /> Connect and compare multiple files together
                </li>
                <li>
                  <CheckIcon size={14} /> Priority customer support
                </li>
              </ul>
              <button
                type="button"
                className="plan-cta-btn btn-primary"
                onClick={() => (isAuthenticated ? onNavigateToApp() : onNavigateToAuth('signup'))}
              >
                {isAuthenticated ? 'Open Workspace' : 'Start Free Trial'}
              </button>
            </div>
          </div>
        </div>
      </section>
  )
}
