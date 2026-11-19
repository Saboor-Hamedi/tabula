import { useEffect, useRef } from 'react'
import { useRouter } from '../../../core/router'
import { ROUTES, userPath } from '../../../core/router/paths'
import { useAuthUser, useUserSlug } from '../../auth/useProfile'
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
