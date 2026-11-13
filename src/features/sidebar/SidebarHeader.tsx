import logoUrl from '../../assets/logo.png'
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
      <div className="brand">
        <img src={logoUrl} alt="Lumina Tabula" className="header-brand-logo" />
      </div>

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
