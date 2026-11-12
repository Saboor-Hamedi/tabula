import { useEffect } from 'react'
import { useRouter } from './hooks'

/**
 * Redirects to another route as a side effect of rendering.
 *
 * Used by the guards: an unauthenticated visitor who opens `#/app` is sent to
 * the sign-in screen and comes back once the session exists.
 */

export interface NavigateProps {
  to: string
  replace?: boolean
}

export function Navigate({ to, replace = true }: NavigateProps) {
  const { navigate } = useRouter()

  useEffect(() => {
    navigate(to, { replace })
  }, [navigate, to, replace])

  return null
}
