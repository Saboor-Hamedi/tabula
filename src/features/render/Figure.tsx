import { useCallback, useRef, useState } from 'react'
import { copyFigureImage, downloadFigureImage, type ImageExportMode } from '../../core/utils/image'
import { CheckIcon, DownloadIcon, ImageIcon } from '../common/Icons'

/**
 * Chart container.
 *
 * Wraps a rendered diagram with the actions a figure needs: copy as a PNG image
 * (for pasting into a deck or a chat) and download as PNG. The chart itself is
 * lazy-loaded, so Mermaid never enters the main bundle.
 */

export interface FigureProps {
  /** File-safe base name, e.g. `chart-monthly-revenue`. */
  name: string
  children: React.ReactNode
}

export function Figure({ name, children }: FigureProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState<ImageExportMode | null>(null)

  const handleCopy = useCallback(async () => {
    const container = containerRef.current
    if (!container) return
    try {
      const mode = await copyFigureImage(container, `${name}.png`)
      setStatus(mode)
      window.setTimeout(() => setStatus(null), 1800)
    } catch {
      setStatus(null)
    }
  }, [name])

  const handleDownload = useCallback(async () => {
    const container = containerRef.current
    if (!container) return
    try {
      await downloadFigureImage(container, `${name}.png`)
    } catch {
      // Nothing to do: the chart was not ready.
    }
  }, [name])

  return (
    <figure className="figure">
      <div className="figure-canvas" ref={containerRef}>
        {children}
      </div>

      <figcaption className="figure-tools">
        <button type="button" className="tool-btn" onClick={handleCopy}>
          {status === 'copied' ? <CheckIcon size={13} /> : <ImageIcon size={13} />}
          <span>{status === 'copied' ? 'Copied' : status === 'downloaded' ? 'Saved' : 'Copy image'}</span>
        </button>
        <button type="button" className="tool-btn" onClick={handleDownload}>
          <DownloadIcon size={13} />
          <span>PNG</span>
        </button>
      </figcaption>
    </figure>
  )
}
