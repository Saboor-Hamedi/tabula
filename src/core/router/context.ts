import { createContext } from 'react'
import type { RouteParams } from './match'

/**
 * The router contexts.
 *
 * They live apart from the components so that the provider, the hooks and the
 * route table can each be a file that exports one kind of thing.
 */

export interface RouterValue {
  path: string
  query: URLSearchParams
  params: RouteParams
  navigate: (to: string, options?: { replace?: boolean }) => void
  back: () => void
}

export const RouterContext = createContext<RouterValue | null>(null)
export const ParamsContext = createContext<RouteParams>({})

/** The parameters of the route that matched. */
export const MatchContext = createContext<RouteParams>({})
