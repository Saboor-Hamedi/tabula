import { useRef } from 'react'
import { ACCEPTED_EXTENSIONS } from '../../core/constants'
import { CloseIcon, DatabaseIcon, PlusIcon } from '../common/Icons'
import { IconButton } from '../common/IconButton'
import { useSessionActions } from '../SessionProvider'

/**
 * Sidebar header.
 *
 * Its height is bound to `--header-height`, the same variable the app header
 * uses, so the two bars always line up across the split.
 *
 * `closable` is only true when the sidebar is an overlay drawer: as a persistent
 * column the header toggle already collapses it, and a second close button in
 * the same view would be redundant.
 */

export interface SidebarHeaderProps {
  onClose: () => void
  closable?: boolean
}

export function SidebarHeader({ onClose, closable = false }: SidebarHeaderProps) {
  const { uploadFile } = useSessionActions()
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div className="sidebar-header">
      <div className="brand">
        <span className="brand-mark" aria-hidden>
          <DatabaseIcon size={16} />
        </span>
        <span className="brand-name">Tabula</span>
      </div>

      <div className="sidebar-header-actions">
        <IconButton label="Add dataset" size="sm" onClick={() => inputRef.current?.click()}>
          <PlusIcon size={16} />
        </IconButton>
        {closable ? (
          <IconButton label="Close sidebar" size="sm" onClick={onClose}>
            <CloseIcon size={16} />
          </IconButton>
        ) : null}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_EXTENSIONS.join(',')}
        className="visually-hidden"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) void uploadFile(file)
          event.target.value = ''
        }}
      />
    </div>
  )
}
