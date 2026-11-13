import {
  ArrowRightIcon,
  ChevronDownIcon,
} from '../../common/Icons'
import { HeroPixelField } from '../../common/HeroPixelField'

/**
 * The hero.
 *
 * One promise, one sentence, two actions. The ribbon underneath is the proof.
 */

export interface HeroProps {
  isAuthenticated: boolean
  onNavigateToAuth: (mode?: 'signin' | 'signup') => void
  onNavigateToApp: () => void
  onTryDemo?: () => void
  scrollTo: (id: string) => void
}

export function Hero({
  isAuthenticated,
  onNavigateToAuth,
  onNavigateToApp,
  onTryDemo,
  scrollTo,
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
            Zero files uploaded or saved.
          </h1>

          <p className="landing-hero-subtitle">
            Open your Excel and CSV files without uploading them to any cloud. Ask questions in
            plain English to get automated charts, business trends, and executive summaries
            in seconds.
          </p>

          <div className="landing-hero-cta-group">
            {isAuthenticated ? (
              <button
                type="button"
                className="landing-cta-btn landing-cta-primary"
                onClick={onNavigateToApp}
              >
                <span>Open Workspace</span>
                <ArrowRightIcon size={14} />
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className="landing-cta-btn landing-cta-primary"
                  onClick={() => onNavigateToAuth('signup')}
                >
                  <span>Start Analyzing Free</span>
                  <ArrowRightIcon size={14} />
                </button>
                {onTryDemo && (
                  <button
                    type="button"
                    className="landing-cta-btn landing-cta-demo"
                    onClick={onTryDemo}
                  >
                    <span>Try the Demo (No Signup)</span>
                    <ArrowRightIcon size={14} />
                  </button>
                )}
              </>
            )}

            <button
              type="button"
              className="landing-cta-btn landing-cta-secondary"
              onClick={() => scrollTo('demo')}
            >
              <span>See Walkthrough</span>
              <ChevronDownIcon size={13} />
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
