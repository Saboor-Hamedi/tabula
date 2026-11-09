import { lazy, Suspense, useCallback, useRef, useState } from 'react'
import {
  readMermaidTextColor,
  readMermaidTitle,
  type FigureChanges,
} from '../../core/parsing/editFigure'
import { hasOpenFence } from '../../core/parsing/parseMessage'
import {
  copyFigureImage,
  downloadFigureImage,
  type ImageExportMode,
} from '../../core/utils/image'
import {
  CheckIcon,
  CodeIcon,
  CopyIcon,
  DownloadIcon,
  ImageIcon,
  PencilIcon,
} from '../common/Icons'
import { useInView } from '../common/useInView'
import { FigureEditor } from './FigureEditor'
import { MermaidFallback } from './MermaidFallback'

/**
 * Mermaid block.
 *
 * Tabbed container between rendered Diagram image and Mermaid source code.
 */

const MermaidDiagram = lazy(() => import('./MermaidDiagram'))

export interface MermaidBlockProps {
  code: string
  streaming?: boolean
  onEdit?: (changes: FigureChanges) => void
}

/** Derives a stable, file-safe name from the diagram's own title. */
function figureName(code: string): string {
  const titleMatch = /title\s+"?([^"\n]+)"?/i.exec(code)
  const base = titleMatch ? titleMatch[1] : 'chart'
  const slug = base
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
  return `tabula-${slug || 'chart'}`
}

export function MermaidBlock({
  code,
  streaming = false,
  onEdit,
}: MermaidBlockProps) {
  const { ref, inView } = useInView<HTMLDivElement>()
  const [tab, setTab] = useState<'diagram' | 'code'>('diagram')
  const [editing, setEditing] = useState(false)
  const [copiedCode, setCopiedCode] = useState(false)
  const [imageStatus, setImageStatus] = useState<ImageExportMode | null>(null)
  const diagramContainerRef = useRef<HTMLDivElement>(null)

  const name = figureName(code)

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopiedCode(true)
      setTimeout(() => setCopiedCode(false), 1600)
    } catch {
      // ignore
    }
  }

  const handleCopyImage = useCallback(async () => {
    const container = diagramContainerRef.current
    if (!container) return
    try {
      const mode = await copyFigureImage(container, `${name}.png`)
      setImageStatus(mode)
      setTimeout(() => setImageStatus(null), 1800)
    } catch {
      setImageStatus(null)
    }
  }, [name])

  const handleDownloadImage = useCallback(async () => {
    const container = diagramContainerRef.current
    if (!container) return
    try {
      await downloadFigureImage(container, `${name}.png`)
    } catch {
      // ignore
    }
  }, [name])

  // A half-written diagram renders as placeholder during streaming
  if (streaming && hasOpenFence(code)) {
    return <MermaidFallback code={code} />
  }

  const lines = code.trim().split('\n')

  return (
    <div className="mermaid-wrapper" ref={ref}>
      <div className="mermaid-wrapper-header">
        <div className="mermaid-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'diagram'}
            className={`mermaid-tab ${tab === 'diagram' ? 'is-active' : ''}`}
            onClick={() => setTab('diagram')}
          >
            <ImageIcon size={13} />
            <span>Diagram</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'code'}
            className={`mermaid-tab ${tab === 'code' ? 'is-active' : ''}`}
            onClick={() => setTab('code')}
          >
            <CodeIcon size={13} />
            <span>Code</span>
          </button>
        </div>

        <div className="mermaid-header-actions">
          {tab === 'diagram' ? (
            <>
              <button
                type="button"
                className="tool-btn"
                onClick={handleCopyImage}
                title="Copy diagram image"
              >
                {imageStatus === 'copied' ? <CheckIcon size={13} /> : <ImageIcon size={13} />}
                <span>{imageStatus === 'copied' ? 'Copied' : imageStatus === 'downloaded' ? 'Saved' : 'Copy'}</span>
              </button>
              <button
                type="button"
                className="tool-btn"
                onClick={handleDownloadImage}
                title="Download as PNG"
              >
                <DownloadIcon size={13} />
                <span>PNG</span>
              </button>
              {onEdit ? (
                <button
                  type="button"
                  className="tool-btn"
                  onClick={() => setEditing(true)}
                  title="Edit diagram"
                >
                  <PencilIcon size={13} />
                  <span>Edit</span>
                </button>
              ) : null}
            </>
          ) : (
            <button
              type="button"
              className="tool-btn"
              onClick={handleCopyCode}
              title="Copy mermaid code"
            >
              {copiedCode ? <CheckIcon size={13} /> : <CopyIcon size={13} />}
              <span>{copiedCode ? 'Copied' : 'Copy code'}</span>
            </button>
          )}
        </div>
      </div>

      <div className="mermaid-wrapper-body">
        {tab === 'diagram' ? (
          <div className="mermaid-diagram-canvas" ref={diagramContainerRef}>
            {inView ? (
              <Suspense fallback={<MermaidFallback />}>
                <MermaidDiagram code={code} />
              </Suspense>
            ) : (
              <MermaidFallback />
            )}
          </div>
        ) : (
          <div className="mermaid-code-view">
            <div className="mermaid-code-lines" aria-hidden="true">
              {lines.map((_, i) => (
                <span key={i} className="mermaid-line-num">
                  {i + 1}
                </span>
              ))}
            </div>
            <pre className="mermaid-code-pre">
              <code>{code.trim()}</code>
            </pre>
          </div>
        )}
      </div>

      {editing && onEdit ? (
        <FigureEditor
          title={readMermaidTitle(code)}
          textColor={readMermaidTextColor(code)}
          onSave={onEdit}
          onClose={() => setEditing(false)}
        />
      ) : null}
    </div>
  )
}
