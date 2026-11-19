import { ArrowRightIcon, CheckIcon } from '../../common/Icons'

/**
 * Pricing — Compact, balanced 3-tier editorial grid.
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
  const handleAction = () => {
    if (isAuthenticated) {
      onNavigateToApp()
    } else {
      onNavigateToAuth('signup')
    }
  }

  return (
    <section id="pricing" className="landing-section landing-pricing-section">
      <div className="landing-container">
        <div className="landing-masthead" data-reveal>
          <div className="landing-masthead-left">
            <span className="landing-kicker">05 — Simple Pricing</span>
            <h2 className="landing-section-title">
              Start free. <span className="landing-serif-italic">Scale effortlessly.</span>
            </h2>
          </div>
          <p className="landing-masthead-desc">
            Full access for 7 days with no credit card required. Cancel anytime with zero hidden
            fees.
          </p>
        </div>

        <div className="editorial-pricing-grid">
          {/* 1. 7-Day Free Trial */}
          <div className="editorial-plan-card" data-reveal data-delay="1">
            <div className="editorial-plan-top">
              <span className="editorial-plan-kicker">Try Free</span>
              <h3 className="editorial-plan-name">7-Day Trial</h3>
              <p className="editorial-plan-desc">
                Test Lumina Tabula on your own spreadsheets with zero commitment.
              </p>
              <div className="editorial-plan-price">
                <span className="editorial-price-num">$0</span>
                <span className="editorial-price-unit">/ 7 days</span>
              </div>
            </div>

            <ul className="editorial-plan-list">
              <li>
                <CheckIcon size={13} /> Full workspace access for 7 days
              </li>
              <li>
                <CheckIcon size={13} /> No credit card required
              </li>
              <li>
                <CheckIcon size={13} /> Instant charts, tables &amp; summaries
              </li>
              <li>
                <CheckIcon size={13} /> 100% private — stays on your device
              </li>
            </ul>

            <button
              type="button"
              className="editorial-plan-btn is-outline"
              onClick={handleAction}
            >
              <span>{isAuthenticated ? 'Open Workspace' : 'Start Free Trial'}</span>
              <ArrowRightIcon size={13} />
            </button>
          </div>

          {/* 2. Pro Analyst (Centerpiece Obsidian Card) */}
          <div className="editorial-plan-card is-ink" data-reveal data-delay="2">
            <div className="editorial-plan-top">
              <div className="editorial-plan-kicker-row">
                <span className="editorial-plan-kicker">Most Popular</span>
              </div>
              <h3 className="editorial-plan-name">Pro Analyst</h3>
              <p className="editorial-plan-desc">
                For professionals, managers, and consultants working daily with data.
              </p>
              <div className="editorial-plan-price">
                <span className="editorial-price-num">$19</span>
                <span className="editorial-price-unit">/ month</span>
              </div>
            </div>

            <ul className="editorial-plan-list">
              <li>
                <CheckIcon size={13} /> <strong>Everything in Free Trial</strong>
              </li>
              <li>
                <CheckIcon size={13} /> Unlimited rows &amp; multi-sheet workbooks
              </li>
              <li>
                <CheckIcon size={13} /> One-click PDF &amp; Word report exports
              </li>
              <li>
                <CheckIcon size={13} /> Compare multiple spreadsheets together
              </li>
              <li>
                <CheckIcon size={13} /> Priority email support
              </li>
            </ul>

            <button
              type="button"
              className="editorial-plan-btn is-light landing-cta-sheen"
              onClick={handleAction}
            >
              <span>{isAuthenticated ? 'Open Workspace' : 'Get Pro Analyst'}</span>
              <ArrowRightIcon size={13} />
            </button>
          </div>

          {/* 3. Team & Business */}
          <div className="editorial-plan-card" data-reveal data-delay="3">
            <div className="editorial-plan-top">
              <span className="editorial-plan-kicker">For Teams</span>
              <h3 className="editorial-plan-name">Business</h3>
              <p className="editorial-plan-desc">
                For finance, operations, and research teams sharing insights securely.
              </p>
              <div className="editorial-plan-price">
                <span className="editorial-price-num">$49</span>
                <span className="editorial-price-unit">/ month</span>
              </div>
            </div>

            <ul className="editorial-plan-list">
              <li>
                <CheckIcon size={13} /> <strong>Everything in Pro Analyst</strong>
              </li>
              <li>
                <CheckIcon size={13} /> Published report hub for stakeholders
              </li>
              <li>
                <CheckIcon size={13} /> Centralized team billing &amp; seats
              </li>
              <li>
                <CheckIcon size={13} /> Zero-upload compliance peace of mind
              </li>
              <li>
                <CheckIcon size={13} /> Dedicated priority support
              </li>
            </ul>

            <button
              type="button"
              className="editorial-plan-btn is-outline"
              onClick={handleAction}
            >
              <span>{isAuthenticated ? 'Open Workspace' : 'Start Business Trial'}</span>
              <ArrowRightIcon size={13} />
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
