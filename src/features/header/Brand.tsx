import { Link } from '../../core/router'
import { ROUTES } from '../../core/router/paths'
import { DatabaseIcon } from '../common/Icons'

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

export function Brand({ to = ROUTES.dashboard, compact = false }: BrandProps) {
  return (
    <Link className="header-brand" to={to} aria-label="Lumina Tabula home">
      <span className="header-brand-badge">
        <DatabaseIcon size={15} />
      </span>
      {compact ? null : <span className="header-brand-name">Lumina Tabula</span>}
    </Link>
  )
}
