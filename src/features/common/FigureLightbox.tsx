import { useEffect } from 'react'
import { CloseIcon, DownloadIcon } from './Icons'

export interface FigureLightboxProps {
  src: string | null
  title: string
  alt?: string
  hideHeader?: boolean
  onDownload?: () => void
  onClose: () => void
}

/**
 * Shared fullscreen lightbox modal for inspecting Python figures and Mermaid diagrams.
 * Single source of truth used by both PythonPanel and MermaidBlock.
 */
export function FigureLightbox({
  src,
  title,
  alt,
  hideHeader = false,
  onDownload,
  onClose,
}: FigureLightboxProps) {
  useEffect(() => {
    if (!src) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [src, onClose])

  if (!src) return null

  return (
    <div
      className="figure-lightbox-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="figure-lightbox-dialog"
        onClick={(event) => event.stopPropagation()}
      >
        {!hideHeader ? (
          <div className="figure-lightbox-bar">
            <span className="figure-lightbox-title">{title}</span>
            <div className="figure-lightbox-actions">
              {onDownload ? (
                <button
                  type="button"
                  className="tool-btn"
                  onClick={onDownload}
                  title="Download PNG"
                >
                  <DownloadIcon size={13} />
                  <span>Download</span>
                </button>
              ) : null}
              <button
                type="button"
                className="tool-btn"
                onClick={onClose}
                title="Close (Esc)"
              >
                <CloseIcon size={14} />
              </button>
            </div>
          </div>
        ) : null}
        <div className="figure-lightbox-view">
          <img
            src={src}
            alt={alt ?? title}
            className="figure-lightbox-img"
          />
        </div>
      </div>
    </div>
  )
}
