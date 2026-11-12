/**
 * The router.
 *
 * A dependency-free hash router: the fragment is the location, so the bundle
 * works from any host without a server rewrite.
 */

export { Link } from './Link'
export { Navigate } from './Navigate'
export { Route, Routes } from './Routes'
export { RouterProvider } from './Router'
export { useMatch, useParams, useQuery, useRouter } from './hooks'
export {
  buildHash,
  joinPath,
  matchPath,
  parseHash,
  type ParsedLocation,
  type RouteParams,
} from './match'
export { insightPath, insightsPath, ROUTES, type RouteName } from './paths'
export { type RouterValue } from './context'
