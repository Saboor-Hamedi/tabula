import { ArrowRightIcon } from '../../common/Icons'

/**
 * The closing call to action.
 */

export interface CtaProps {
  isAuthenticated: boolean
  onNavigateToAuth: (mode?: 'signin' | 'signup') => void
  onNavigateToApp: () => void
}

export function Cta({ isAuthenticated, onNavigateToAuth, onNavigateToApp }: CtaProps) {
  return (
<section className="landing-final-cta">
        <div className="landing-container">
          <div className="landing-cta-inner">
            <h2 className="landing-cta-title">
              Ready to analyze your data with total privacy?
            </h2>
            <p className="landing-cta-desc">
              No credit card required. Drop in your spreadsheet and start asking questions immediately.
            </p>
            <div className="landing-cta-buttons">
              <button
                type="button"
                className="landing-cta-btn landing-cta-primary"
                onClick={() => (isAuthenticated ? onNavigateToApp() : onNavigateToAuth('signup'))}
              >
                <span>{isAuthenticated ? 'Open Workspace' : 'Get Started Free'}</span>
                <ArrowRightIcon size={14} />
              </button>
            </div>
          </div>
        </div>
      </section>
  )
}
