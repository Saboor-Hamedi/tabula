import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { ParamsContext, RouterContext } from './context'
import { normalizeRouteTarget, parseBrowserLocation } from './match'

/**
 * The router provider.
 *
 * Uses clean History API URLs (e.g. `/saboor/workspace`) while transparently
 * accepting legacy `#/route` hashes (e.g. from bookmarks or email redirects).
 */

function readCurrentLocation() {
  if (typeof window === 'undefined') {
    return { path: '/', query: new URLSearchParams() }
  }
  return parseBrowserLocation(
    window.location.pathname,
    window.location.search,
    window.location.hash,
  )
}

export function RouterProvider({ children }: { children: ReactNode }) {
  const [location, setLocation] = useState(readCurrentLocation)

  useEffect(() => {
    const sync = () => setLocation(readCurrentLocation())
    window.addEventListener('popstate', sync)
    window.addEventListener('hashchange', sync)
    return () => {
      window.removeEventListener('popstate', sync)
      window.removeEventListener('hashchange', sync)
    }
  }, [])

  const navigate = useCallback((to: string, options: { replace?: boolean } = {}) => {
    const target = normalizeRouteTarget(to)
    const current = `${window.location.pathname}${window.location.search}`
    if (target === current && !window.location.hash) return

    if (options.replace) {
      window.history.replaceState(null, '', target)
    } else {
      window.history.pushState(null, '', target)
    }
    setLocation(readCurrentLocation())
  }, [])

  const back = useCallback(() => {
    window.history.back()
  }, [])

  const value = useMemo(
    () => ({
      path: location.path,
      query: location.query,
      params: {} as Record<string, string>,
      navigate,
      back,
    }),
    [location.path, location.query, navigate, back],
  )

  return (
    <RouterContext.Provider value={value}>
      <ParamsContext.Provider value={value.params}>{children}</ParamsContext.Provider>
    </RouterContext.Provider>
  )
}
