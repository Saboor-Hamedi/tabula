import { ArrowRightIcon, ChevronDownIcon } from '../../common/Icons'
import { HeroPixelField } from '../../common/HeroPixelField'

/**
 * The hero.
 *
 * Full-width, full-viewport editorial centerpiece.
 * Architectural ledger lines, living light, expressive serif-sans contrast,
 * and zero visual clutter.
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
  scrollTo,
}: HeroProps) {
  return (
    <section className="landing-hero">
      <div className="hero-ledger-grid" aria-hidden="true" />
      <HeroPixelField />
      <div className="landing-hero-aurora" aria-hidden="true">
        <span className="hero-orb hero-orb-1" />
        <span className="hero-orb hero-orb-2" />
      </div>

      <div className="landing-container landing-hero-inner">
        <h1 className="landing-hero-title hero-anim hero-anim-1">
          Ask your spreadsheets
          <span className="landing-hero-serif">anything.</span>
        </h1>

        <p className="landing-hero-subtitle hero-anim hero-anim-2">
          Open Excel or CSV files with millions of rows and get clear answers, charts, and
          executive summaries — without a single byte ever leaving your computer.
        </p>

        <div className="landing-hero-cta-group hero-anim hero-anim-3">
          <button
            type="button"
            className="landing-cta-btn landing-cta-primary landing-cta-lg landing-cta-sheen"
            onClick={() => (isAuthenticated ? onNavigateToApp() : onNavigateToAuth('signup'))}
          >
            <span>{isAuthenticated ? 'Open Workspace' : 'Start Free Trial'}</span>
            <ArrowRightIcon size={16} />
          </button>

          <button
            type="button"
            className="landing-hero-text-link"
            onClick={() => scrollTo?.('demo')}
          >
            <span>See how it works</span>
            <ChevronDownIcon size={15} />
          </button>
        </div>

        <p className="landing-hero-footnote hero-anim hero-anim-4">
          7-day free trial &nbsp;·&nbsp; No credit card required &nbsp;·&nbsp; Works offline
        </p>
      </div>

      <button
        type="button"
        className="landing-hero-scroll"
        aria-label="Scroll to interactive showcase"
        onClick={() => scrollTo?.('demo')}
      >
        <ChevronDownIcon size={16} />
      </button>
    </section>
  )
}
