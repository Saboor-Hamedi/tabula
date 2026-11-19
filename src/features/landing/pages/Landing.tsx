import { useEffect, useRef, useState } from 'react'
import { useRouter } from '../../../core/router'
import { ROUTES, userPath } from '../../../core/router/paths'
import { useAuthUser, useUserSlug } from '../../auth/useProfile'
import { Header } from '../../header/Header'
import { DEMO_SCENARIOS, type DemoScenario } from '../data'
import { Comparison } from '../components/Comparison'
import { Cta } from '../components/Cta'
import { Demo } from '../components/Demo'
import { Faq } from '../components/Faq'
import { Features } from '../components/Features'
import { Footer } from '../components/Footer'
import { Hero } from '../components/Hero'
import { Insights } from '../components/Insights'
import { Privacy } from '../components/Privacy'
import { Pricing } from '../components/Pricing'

/**
 * The front page.
 *
 * Uses the same unified `<Header />` as Insights and Articles, and drives
 * smooth scroll-reveal motion across every section and post card.
 */
export function Landing() {
  const { navigate } = useRouter()
  const user = useAuthUser()
  const userSlug = useUserSlug()
  const [activeScenario, setActiveScenario] = useState<DemoScenario>(DEMO_SCENARIOS[0])
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0)
  const pageRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const root = pageRef.current
    if (!root) return

    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const revealSelector = '[data-reveal], .post-card'

    if (reducedMotion || typeof IntersectionObserver === 'undefined') {
      root.querySelectorAll<HTMLElement>(revealSelector).forEach((el) => {
        el.classList.add('is-visible')
      })
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible')
            observer.unobserve(entry.target)
          }
        }
      },
      { threshold: 0.08, rootMargin: '0px 0px -32px 0px' },
    )

    const observeAll = () => {
      root.querySelectorAll<HTMLElement>(revealSelector).forEach((el, index) => {
        if (el.classList.contains('is-visible')) return
        if (el.classList.contains('post-card') && !el.dataset.delay) {
          el.dataset.delay = String((index % 3) + 1)
        }
        observer.observe(el)
      })
    }

    observeAll()

    // Watch for async-loaded posts appearing in the feed
    const mutation = new MutationObserver(() => observeAll())
    mutation.observe(root, { childList: true, subtree: true })

    return () => {
      observer.disconnect()
      mutation.disconnect()
    }
  }, [])

  const scrollTo = (id: string) => {
    const element = document.getElementById(id)
    element?.scrollIntoView({ behavior: 'smooth' })
  }

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

      <Hero
        isAuthenticated={isSignedInAccount}
        onNavigateToAuth={navigateToWorkspace}
        onNavigateToApp={navigateToWorkspace}
        scrollTo={scrollTo}
      />

      <Demo
        activeScenario={activeScenario}
        setActiveScenario={setActiveScenario}
        isAuthenticated={isSignedInAccount}
        onNavigateToAuth={navigateToWorkspace}
        onNavigateToApp={navigateToWorkspace}
      />

      <Insights />

      <Privacy />

      <Features />

      <Comparison />

      <Pricing
        isAuthenticated={isSignedInAccount}
        onNavigateToAuth={navigateToWorkspace}
        onNavigateToApp={navigateToWorkspace}
      />

      <Faq openIndex={openFaqIndex} setOpenIndex={setOpenFaqIndex} />

      <Cta
        isAuthenticated={isSignedInAccount}
        onNavigateToAuth={navigateToWorkspace}
        onNavigateToApp={navigateToWorkspace}
      />

      <Footer />
    </div>
  )
}
