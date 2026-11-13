import { ArrowRightIcon } from '../../common/Icons'
import { HeroPixelField } from '../../common/HeroPixelField'

/**
 * The hero.
 *
 * One promise, one sentence, one clear Workspace action.
 */

export interface HeroProps {
  isAuthenticated: boolean
  onNavigateToAuth: (mode?: 'signin' | 'signup') => void
  onNavigateToApp: () => void
  onTryDemo?: () => void
  scrollTo?: (id: string) => void
}

export function Hero({
  isAuthenticated,
  onNavigateToAuth,
  onNavigateToApp,
}: HeroProps) {
  return (
<section className="landing-hero">
      <HeroPixelField />
        <div className="landing-container landing-hero-inner">
          <div className="landing-hero-eyebrow">
            <span className="landing-hero-eyebrow-dot" />
            <span>Private, local-first spreadsheet intelligence</span>
          </div>
          <h1 className="landing-hero-title">
            Instant spreadsheet answers. <br />
            Zero files uploaded.
          </h1>

          <p className="landing-hero-subtitle">
            Analyze Excel and CSV files locally in your browser with automated charts and summaries.
          </p>

          <div className="landing-hero-cta-group">
            <button
              type="button"
              className="landing-cta-btn landing-cta-primary"
              onClick={() => (isAuthenticated ? onNavigateToApp() : onNavigateToAuth('signup'))}
            >
              <span>Workspace</span>
              <ArrowRightIcon size={16} />
            </button>
          </div>

          {/* Understated Trust Metrics */}
          <div className="landing-metrics-ribbon">
            <div className="landing-metric-item">
              <span className="landing-metric-val">100%</span>
              <span className="landing-metric-label">Runs On Your Device</span>
            </div>
            <div className="landing-metric-item">
              <span className="landing-metric-val">0 Bytes</span>
              <span className="landing-metric-label">Uploaded To Servers</span>
            </div>
            <div className="landing-metric-item">
              <span className="landing-metric-val">Instant</span>
              <span className="landing-metric-label">No Waiting Or Queue</span>
            </div>
            <div className="landing-metric-item">
              <span className="landing-metric-val">Safe</span>
              <span className="landing-metric-label">Confidential & Compliant</span>
            </div>
          </div>
        </div>
      </section>
  )
}
