import { useState } from 'react'
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
 * Uses the same unified `<Header />` as Insights and Articles, and keeps
 * landing sections isolated from Dashboard and Workspace.
 */
export function Landing() {
  const { navigate } = useRouter()
  const user = useAuthUser()
  const userSlug = useUserSlug()
  const [activeScenario, setActiveScenario] = useState<DemoScenario>(DEMO_SCENARIOS[0])
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0)

  const scrollTo = (id: string) => {
    const element = document.getElementById(id)
    element?.scrollIntoView({ behavior: 'smooth' })
  }

  const navigateToAuth = (mode: 'signin' | 'signup' = 'signin') => {
    navigate(mode === 'signup' ? ROUTES.signUp : ROUTES.signIn)
  }

  const navigateToWorkspace = () => {
    navigate(user ? userPath('/workspace', userSlug) : ROUTES.signUp)
  }

  return (
    <div className="landing-page">
      <Header
        variant="page"
        onSignIn={() => navigateToAuth('signin')}
        onSignUp={() => navigateToAuth('signup')}
      />

      <Hero
        isAuthenticated={Boolean(user)}
        onNavigateToAuth={navigateToAuth}
        onNavigateToApp={navigateToWorkspace}
        scrollTo={scrollTo}
      />

      <Demo
        activeScenario={activeScenario}
        setActiveScenario={setActiveScenario}
        isAuthenticated={Boolean(user)}
        onNavigateToAuth={navigateToAuth}
        onNavigateToApp={navigateToWorkspace}
      />

      <Insights />

      <Privacy />

      <Features />

      <Comparison />

      <Pricing
        isAuthenticated={Boolean(user)}
        onNavigateToAuth={navigateToAuth}
        onNavigateToApp={navigateToWorkspace}
      />

      <Faq openIndex={openFaqIndex} setOpenIndex={setOpenFaqIndex} />

      <Cta
        isAuthenticated={Boolean(user)}
        onNavigateToAuth={navigateToAuth}
        onNavigateToApp={navigateToWorkspace}
      />

      <Footer />
    </div>
  )
}
