import { Children, type ReactNode } from 'react'
import { MatchContext } from './context'
import { matchPath } from './match'
import { useRouter } from './hooks'

/**
 * The route table.
 *
 * `<Routes>` walks its children in order and renders the first `<Route>` whose
 * pattern matches the current path. A trailing `*` catches everything else.
 */

export interface RouteProps {
  /** Pattern, e.g. `/insights/:slug`. */
  path: string
  element: ReactNode
}

export function Route({ element }: RouteProps) {
  return <>{element}</>
}

export interface RoutesProps {
  children: ReactNode
  /** Rendered when nothing matches. */
  fallback?: ReactNode
}

export function Routes({ children, fallback = null }: RoutesProps) {
  const { path } = useRouter()

  for (const child of Children.toArray(children)) {
    if (!isRouteElement(child)) continue
    const params = matchPath(child.props.path, path)
    if (params) {
      return (
        <MatchContext.Provider value={params}>{child.props.element}</MatchContext.Provider>
      )
    }
  }

  return <>{fallback}</>
}

function isRouteElement(child: ReactNode): child is React.ReactElement<RouteProps> {
  return (
    typeof child === 'object' &&
    child !== null &&
    'props' in child &&
    typeof (child as React.ReactElement<RouteProps>).props?.path === 'string'
  )
}
