import { Link } from '../../core/router'
import { ROUTES } from '../../core/router/paths'
import logoUrl from '../../assets/logo.png'

/**
 * The brand.
 *
 * One component so the wordmark, the badge and the destination never drift
 * between the workspace header and the public pages.
 */

export interface BrandProps {
  to?: string
  /** Hides the wordmark, leaving only the badge. */
  compact?: boolean
}

export function Brand({ to = ROUTES.dashboard }: BrandProps) {
  return (
    <Link className="header-brand" to={to} aria-label="Lumina Tabula home">
      <img src={logoUrl} alt="Lumina Tabula" className="header-brand-logo" />
    </Link>
  )
}
