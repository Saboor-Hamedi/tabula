import { useEffect, useRef, useState } from 'react'
import { useRouter } from '../../../core/router'
import { ROUTES, userPath } from '../../../core/router/paths'
import { useAuthUser, useUserSlug } from '../../auth/useProfile'
import { Header } from '../../header/Header'
import { Cta } from '../components/Cta'
import { Faq } from '../components/Faq'
import { Footer } from '../components/Footer'
import { Pricing } from '../components/Pricing'

/**
 * Dedicated `/pricing` routed page.
 *
 * Showcases Plans, Token Quotas, and Frequently Asked Questions.
 */
export function PricingPage() {
  const { navigate } = useRouter()
  const user = useAuthUser()
  const userSlug = useUserSlug()
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0)
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
