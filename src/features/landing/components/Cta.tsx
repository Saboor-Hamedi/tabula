import { ArrowRightIcon } from '../../common/Icons'

/**
 * Full-bleed dark editorial closing band.
 */

export interface CtaProps {
  isAuthenticated: boolean
  onNavigateToAuth: (mode?: 'signin' | 'signup') => void
  onNavigateToApp: () => void
}

export function Cta({ isAuthenticated, onNavigateToAuth, onNavigateToApp }: CtaProps) {
  return (
    <section className="landing-final-band">
      <div className="landing-final-grid" aria-hidden="true" />
      <div className="landing-container landing-final-inner" data-reveal>
        <h2 className="landing-final-title">
          Your spreadsheets,
          <span className="landing-final-serif">finally private.</span>
        </h2>
        <p className="landing-final-desc">
          Start your 7-day free trial with no credit card required. Drop in your first Excel or CSV
          file and get answers in seconds.
        </p>
        <div className="landing-cta-buttons">
          <button
            type="button"
            className="landing-final-btn landing-cta-sheen"
            onClick={() => (isAuthenticated ? onNavigateToApp() : onNavigateToAuth('signup'))}
          >
            <span>{isAuthenticated ? 'Open Workspace' : 'Start Free Trial'}</span>
            <ArrowRightIcon size={16} />
          </button>
        </div>
      </div>
    </section>
  )
}
