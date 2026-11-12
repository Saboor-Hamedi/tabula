import type { AnchorHTMLAttributes, MouseEvent, ReactNode } from 'react'
import { useRouter } from './hooks'
import { normalizeRouteTarget } from './match'

/**
 * A link that routes without a page reload.
 *
 * The `href` is a clean pathname so the link can be opened in a new tab,
 * copied or crawled exactly like any other anchor.
 */

export interface LinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  to: string
  children: ReactNode
  /** Replace the current history entry instead of pushing one. */
  replace?: boolean
}

export function Link({ to, children, replace, onClick, ...rest }: LinkProps) {
  const { navigate } = useRouter()
  const href = normalizeRouteTarget(to)

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event)
    if (event.defaultPrevented) return
    // Let the browser handle modified clicks (new tab, download, copy link).
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    if (event.button !== 0) return
    event.preventDefault()
    navigate(href, { replace })
  }

  return (
    <a href={href} onClick={handleClick} {...rest}>
      {children}
    </a>
  )
}
