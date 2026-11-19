import { ArrowRightIcon, ChevronDownIcon, SparklesIcon } from '../../common/Icons'
import { HeroPixelField } from '../../common/HeroPixelField'
import { HeroSearch } from './HeroSearch'

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
  const handleLaunchInstantDemo = () => {
    try {
      sessionStorage.setItem('tabula:pending-sample', '/orders.csv::orders.csv')
    } catch {
      // ignore
    }
    onNavigateToApp()
  }

  return (
    <section className="landing-hero">
      <div className="hero-ledger-grid" aria-hidden="true" />
      <HeroPixelField />
      <div className="landing-hero-aurora" aria-hidden="true">
        <span className="hero-orb hero-orb-1" />
        <span className="hero-orb hero-orb-2" />
      </div>

      <div className="landing-container landing-hero-inner">
        <HeroSearch />

        <h1 className="landing-hero-title hero-anim hero-anim-2">
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
            <span>{isAuthenticated ? 'Open Workspace' : 'Analyze Free Now'}</span>
            <ArrowRightIcon size={16} />
          </button>

          <button
            type="button"
            className="landing-cta-btn landing-cta-secondary landing-cta-lg"
            onClick={handleLaunchInstantDemo}
            title="Load sample dataset instantly into the in-browser workspace"
          >
            <SparklesIcon size={15} />
            <span>Try 1-Click Demo</span>
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
          No sign-up required &nbsp;·&nbsp; 100% in-browser DuckDB WebAssembly &nbsp;·&nbsp; Zero files uploaded
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
