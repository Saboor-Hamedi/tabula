import { useCallback, useRef, useState } from 'react'
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
import { FigureEditor } from '../render/FigureEditor'
import { MermaidFallback } from './MermaidFallback'
import { MermaidImageBox } from './MermaidImageBox'
import { figureName } from './utils/mermaidUtils'

export interface MermaidBlockProps {
  code: string
  streaming?: boolean
  onEdit?: (changes: FigureChanges) => void
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
      setTimeout(() => setImageStatus(null), 2000)
    } catch (err) {
      console.warn('Copy image failed, falling back to download:', err)
      try {
        await downloadFigureImage(container, `${name}.png`)
        setImageStatus('downloaded')
        setTimeout(() => setImageStatus(null), 2000)
      } catch {
        setImageStatus(null)
      }
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
          <MermaidImageBox
            code={code}
            inView={inView}
            containerRef={diagramContainerRef}
          />
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
export default MermaidBlock
