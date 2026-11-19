import logoUrl from '../../assets/logo.png'
import { Link } from '../../core/router'
import { ROUTES } from '../../core/router/paths'
import { CloseIcon } from '../common/Icons'
import { IconButton } from '../common/IconButton'

/**
 * Sidebar header.
 *
 * Its height is bound to `--header-height`, the same variable the app header
 * uses, so the two bars always line up across the split.
 */

export interface SidebarHeaderProps {
  onClose: () => void
  closable?: boolean
}

export function SidebarHeader({ onClose, closable = false }: SidebarHeaderProps) {
  return (
    <div className="sidebar-header">
      <Link className="brand header-brand" to={ROUTES.landing} aria-label="Lumina Tabula home">
        <img src={logoUrl} alt="" className="header-brand-logo" />
        <span className="header-brand-name">Lumina Tabula</span>
      </Link>

      {closable ? (
        <div className="sidebar-header-actions">
          <IconButton label="Close sidebar" size="sm" onClick={onClose}>
            <CloseIcon size={16} />
          </IconButton>
        </div>
      ) : null}
    </div>
  )
}
