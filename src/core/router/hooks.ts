import { useContext } from 'react'
import {
  MatchContext,
  ParamsContext,
  RouterContext,
  type RouterValue,
} from './context'

/**
 * The router hooks.
 */

/** The current path, query and navigation helpers. */
export function useRouter(): RouterValue {
  const value = useContext(RouterContext)
  if (!value) {
    throw new Error('Router hooks must be used inside <RouterProvider>.')
  }
  return value
}

/** The parameters of the matched route, e.g. `{ slug: 'q3-revenue' }`. */
export function useParams(): Record<string, string> {
  const match = useContext(MatchContext)
  const root = useContext(ParamsContext)
  return Object.keys(match).length > 0 ? match : root
}

/** The query string of the current location. */
export function useQuery(): URLSearchParams {
  return useRouter().query
}

/** The parameters of the route that matched. */
export function useMatch(): Record<string, string> {
  return useContext(MatchContext)
}
