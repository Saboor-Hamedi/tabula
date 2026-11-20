import { useEffect, useRef } from 'react'
import { useRouter } from '../../../core/router'
import { ROUTES, userPath } from '../../../core/router/paths'
import { useAuthUser, useUserSlug } from '../../auth/useProfile'
import { HeroPixelField } from '../../common/HeroPixelField'
import { ArrowRightIcon, BarChartIcon, DatabaseIcon, ShieldCheckIcon, ZapIcon } from '../../common/Icons'
import { Header } from '../../header/Header'
import { Comparison } from '../components/Comparison'
import { Cta } from '../components/Cta'
import { Features } from '../components/Features'
import { Footer } from '../components/Footer'
import { Privacy } from '../components/Privacy'

/**
 * Dedicated `/features` routed page.
 *
 * Showcases Capabilities, Comparison, and Local-First Privacy Architecture.
 */
export function FeaturesPage() {
  const { navigate } = useRouter()
  const user = useAuthUser()
  const userSlug = useUserSlug()
  const pageRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const root = pageRef.current
    if (!root) return
    root.querySelectorAll<HTMLElement>('[data-reveal]').forEach((el) => {
      el.classList.add('is-visible')
    })
  }, [])

  const isSignedInAccount = Boolean(user && !user.is_anonymous)

  const navigateToAuth = (mode: 'signin' | 'signup' = 'signin') => {
    navigate(mode === 'signup' ? ROUTES.signUp : ROUTES.signIn)
  }

  const navigateToWorkspace = () => {
    navigate(isSignedInAccount ? userPath('/workspace', userSlug) : ROUTES.workspace)
  }

  return (
    <div ref={pageRef} className="landing-page">
      <Header
        variant="page"
        onSignIn={() => navigateToAuth('signin')}
        onSignUp={() => navigateToAuth('signup')}
      />

      <section className="subpage-hero">
        <div className="hero-ledger-grid" aria-hidden="true" />
        <HeroPixelField />
        <div className="subpage-hero-inner">
          <span className="subpage-hero-kicker">
            <ZapIcon size={12} />
            <span>Capabilities &amp; Architecture</span>
          </span>
          <h1 className="subpage-hero-title">
            Built for serious{' '}
            <span className="landing-hero-serif">spreadsheet work.</span>
          </h1>
          <p className="subpage-hero-subtitle">
            An in-browser DuckDB analytical engine paired with an AI analyst that writes real SQL,
            renders publication-grade charts, and keeps every byte on your computer.
          </p>
          <div className="subpage-hero-actions">
            <button
              type="button"
              className="landing-cta-btn landing-cta-primary landing-cta-sheen"
              onClick={navigateToWorkspace}
            >
              <span>{isSignedInAccount ? 'Open Workspace' : 'Analyze Free Now'}</span>
              <ArrowRightIcon size={15} />
            </button>
          </div>
          <div className="subpage-hero-meta">
            <span className="subpage-hero-pill">
              <DatabaseIcon size={13} />
              <span>DuckDB-WASM Engine</span>
            </span>
            <span className="subpage-hero-pill">
              <ShieldCheckIcon size={13} />
              <span>Zero Server Upload</span>
            </span>
            <span className="subpage-hero-pill">
              <BarChartIcon size={13} />
              <span>Publication Charts</span>
            </span>
          </div>
        </div>
      </section>

      <Features />

      <Comparison />

      <Privacy />

      <Cta
        isAuthenticated={isSignedInAccount}
        onNavigateToAuth={navigateToWorkspace}
        onNavigateToApp={navigateToWorkspace}
      />

      <Footer />
    </div>
  )
}
