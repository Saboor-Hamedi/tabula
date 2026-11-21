import {
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react'
import type { PythonExecutionResult } from '../../core/python/types'
import type { ExecutedCodeTable } from '../../core/types'
import {
  CheckIcon,
  ChevronDownIcon,
  CopyIcon,
  DownloadIcon,
  ExternalIcon,
  PencilIcon,
  PlayIcon,
  RefreshIcon,
  SendIcon,
} from '../common/Icons'
import { FigureLightbox } from '../common/FigureLightbox'
import {
  cleanCodeError,
  formatPythonForDisplay,
  formatSqlForDisplay,
} from '../../tabula/utils/agentHelpers'
import { SessionActionsContext, SessionStateContext } from '../session/sessionContext'
import { CodeHighlight } from './CodeHighlight'
import { DataTable } from './DataTable'

  export interface CodeBlockProps {
  code: string
  className?: string
  purpose?: string
  status?: 'running' | 'done'
  initialElapsedMs?: number
  initialTable?: ExecutedCodeTable
  initialImages?: string[]
  initialStdout?: string
  defaultCollapsed?: boolean
}

export function CodeBlock({
  code,
  className,
  purpose,
  status = 'done',
  initialTable,
  initialImages,
  initialStdout,
  defaultCollapsed = true,
}: CodeBlockProps) {
  const sessionActions = useContext(SessionActionsContext)
  const sessionState = useContext(SessionStateContext)

  const rawLang = className ? className.replace(/^language-/, '').toLowerCase() : ''
  const isPython = rawLang === 'python' || rawLang === 'py'
  const isSql = rawLang === 'sql' || rawLang === 'duckdb'
  const isExecutable = isPython || isSql

  const cleanInitialCode = useMemo(() => {
    if (isSql) return formatSqlForDisplay(code)
    if (isPython) return formatPythonForDisplay(code)
    return code.replace(/\r\n/g, '\n').trim()
  }, [code, isPython, isSql])

  // Dropdown (collapse/expand) state
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed)

  // In-place code editor state
  const [currentCode, setCurrentCode] = useState(cleanInitialCode)
  const [isEditing, setIsEditing] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Inline "Ask agent to edit" prompt state
  const [isAskingAgent, setIsAskingAgent] = useState(false)
  const [askPrompt, setAskPrompt] = useState('')
  const askInputRef = useRef<HTMLInputElement>(null)

  // Execution & copy state
  const [copied, setCopied] = useState(false)
  const [copiedStdout, setCopiedStdout] = useState(false)
  const [copiedImgIdx, setCopiedImgIdx] = useState<number | null>(null)
  const [runningThis, setRunningThis] = useState(false)
  const [localPyResult, setLocalPyResult] = useState<PythonExecutionResult | null>(null)
  const [localSqlResult, setLocalSqlResult] = useState<{
    table?: ExecutedCodeTable
    elapsedMs: number
    error?: string
  } | null>(null)
  const [lightboxImg, setLightboxImg] = useState<{ url: string; index: number } | null>(null)

  const isModified = currentCode.trim() !== cleanInitialCode.trim()
  const displayCode = useMemo(() => currentCode.replace(/[\r\n\s]+$/, ''), [currentCode])
  const displayLines = useMemo(
    () => (displayCode.length > 0 ? displayCode.split('\n') : ['']),
    [displayCode],
  )
  const editorLines = useMemo(() => currentCode.split('\n'), [currentCode])
  const isLiveRunning = runningThis || status === 'running'

  useEffect(() => {
    setCurrentCode(cleanInitialCode)
  }, [cleanInitialCode])

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [isEditing])

  useEffect(() => {
    if (isAskingAgent && askInputRef.current) {
      askInputRef.current.focus()
    }
  }, [isAskingAgent])

  useEffect(() => {
    const textarea = textareaRef.current
    if (textarea && isEditing) {
      textarea.style.height = 'auto'
      const targetHeight = Math.max(editorLines.length * 18, 18) + 12
      textarea.style.height = `${Math.max(textarea.scrollHeight, targetHeight)}px`
    }
  }, [currentCode, isEditing, editorLines.length])

  const handleCopy = async (text: string, setter: (v: boolean) => void) => {
    try {
      await navigator.clipboard.writeText(text)
      setter(true)
      window.setTimeout(() => setter(false), 1600)
    } catch {
      // Ignore clipboard failure
    }
  }

  const handleCopyImage = async (dataUrl: string, index: number) => {
    try {
      const res = await fetch(dataUrl)
      const blob = await res.blob()
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
      setCopiedImgIdx(index)
      window.setTimeout(() => setCopiedImgIdx(null), 1600)
    } catch {
      // Fallback
    }
  }

  const handleDownloadImage = (dataUrl: string, index: number) => {
    const anchor = document.createElement('a')
    anchor.href = dataUrl
    const baseName = sessionState?.activeSession?.fileName?.replace(/\.[^.]+$/, '') || 'analysis'
    anchor.download = `${baseName}-figure-${index + 1}.png`
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
  }

  const handleRun = async () => {
    if (!sessionActions) return
    setRunningThis(true)
    try {
      if (isPython) {
        const res = await sessionActions.runPythonCode(currentCode, { openPanel: false })
        setLocalPyResult(res)
      } else if (isSql) {
        const res = await sessionActions.runSqlCode(currentCode)
        setLocalSqlResult(res)
      }
    } catch (err) {
      if (isPython) {
        setLocalPyResult({
          code: currentCode,
          stdout: '',
          stderr: '',
          images: [],
          elapsedMs: 0,
          error: err instanceof Error ? err.message : 'Execution failed.',
          executedAt: Date.now(),
        })
      } else {
        setLocalSqlResult({
          elapsedMs: 0,
          error: err instanceof Error ? err.message : 'Query execution failed.',
        })
      }
    } finally {
      setRunningThis(false)
    }
  }

  const handleReset = () => {
    setCurrentCode(cleanInitialCode)
    setLocalPyResult(null)
    setLocalSqlResult(null)
  }

  const handleToggleEdit = () => {
    if (!isEditing && isCollapsed) {
      setIsCollapsed(false)
    }
    setIsEditing((prev) => !prev)
  }

  // Active outputs to display directly under the code wrapper
  const activeError = isPython
    ? localPyResult?.error
      ? cleanCodeError(localPyResult.error)
      : null
    : isSql
      ? localSqlResult?.error
        ? cleanCodeError(localSqlResult.error)
        : null
      : null

  const activeImages = useMemo<string[]>(() => {
    if (isPython && localPyResult) {
      return Array.isArray(localPyResult.images) ? localPyResult.images : []
    }
    return Array.isArray(initialImages) ? initialImages : []
  }, [initialImages, isPython, localPyResult])

  const activeTable = useMemo<ExecutedCodeTable | undefined>(() => {
    if (isSql && localSqlResult) {
      return localSqlResult.table
    }
    if (isPython && localPyResult) {
      if (localPyResult.error) return undefined
      const preview = localPyResult.dfPreview
      const hasImgs = Array.isArray(localPyResult.images) && localPyResult.images.length > 0
      const hasOut = Boolean(localPyResult.stdout?.trim())
      const dfChanged = localPyResult.dfInfo?.dfChanged !== false
      if (
        preview &&
        Array.isArray(preview.columns) &&
        preview.columns.length > 0 &&
        (dfChanged || (!hasImgs && !hasOut))
      ) {
        return {
          headers: preview.columns,
          rows: preview.rows,
          totalRows: preview.totalRows,
          totalCols: preview.totalCols,
        }
      }
      return undefined
    }
    return initialTable
  }, [initialTable, isPython, isSql, localPyResult, localSqlResult])

  const activeStdout = useMemo<string>(() => {
    if (isPython && localPyResult) {
      return localPyResult.stdout?.trim() ?? ''
    }
    return initialStdout?.trim() ?? ''
  }, [initialStdout, isPython, localPyResult])

  const handleAskAgentSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const instruction = askPrompt.trim()
    if (!instruction || !sessionActions || sessionState?.isStreaming) return

    const langLabel = isSql ? 'SQL' : isPython ? 'Python' : languageLabel
    const fenceLang = isSql ? 'sql' : isPython ? 'python' : rawLang || 'text'
    const codeSnippet =
      currentCode.length > 1100 ? `${currentCode.slice(0, 1100)}\n# ...` : currentCode
    const errorContext = activeError ? `\nIssue observed: ${activeError}` : ''
    const hiddenContext = `[Target ${langLabel} code to edit:\n\`\`\`${fenceLang}\n${codeSnippet}\n\`\`\`${errorContext}\nPlease update and execute the revised ${langLabel} code.]`

    setIsAskingAgent(false)
    setAskPrompt('')
    await sessionActions.sendMessage(instruction, { hiddenContext })
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      void handleRun()
      return
    }

    if (e.key === 'Tab') {
      e.preventDefault()
      const textarea = textareaRef.current
      if (!textarea) return
      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const spaces = isSql ? '  ' : '    '

      if (e.shiftKey) {
        const before = currentCode.substring(0, start)
        const lineStart = before.lastIndexOf('\n') + 1
        if (currentCode.substring(lineStart, lineStart + spaces.length) === spaces) {
          const next =
            currentCode.substring(0, lineStart) + currentCode.substring(lineStart + spaces.length)
          setCurrentCode(next)
          requestAnimationFrame(() => {
            textarea.selectionStart = Math.max(lineStart, start - spaces.length)
            textarea.selectionEnd = Math.max(lineStart, end - spaces.length)
          })
        }
      } else {
        const next = currentCode.substring(0, start) + spaces + currentCode.substring(end)
        setCurrentCode(next)
        requestAnimationFrame(() => {
          textarea.selectionStart = textarea.selectionEnd = start + spaces.length
        })
      }
    }
  }

  const languageLabel = isPython ? 'Python' : isSql ? 'SQL' : rawLang || 'Code'
  const hasUnderOutputs =
    activeImages.length > 0 ||
    Boolean(activeTable && activeTable.headers.length > 0 && activeTable.rows.length > 0) ||
    Boolean(activeStdout) ||
    Boolean(activeError)

  return (
    <div className="code-block-root">
      <div
        className={`code-block-container ${isPython ? 'is-python' : ''} ${isSql ? 'is-sql' : ''} ${
          isEditing ? 'is-editing-mode' : ''
        } ${isCollapsed ? 'is-collapsed' : ''}`}
      >
        {/* Minimal, Uncrowded Header Bar — No technical names, titles, or line counts */}
        <div className="code-block-header">
          <button
            type="button"
            className="code-dropdown-toggle"
            onClick={() => setIsCollapsed((prev) => !prev)}
            aria-expanded={!isCollapsed}
            title={isCollapsed ? 'Expand code' : 'Collapse code'}
          >
            <ChevronDownIcon
              size={12}
              className={`code-dropdown-chevron ${isCollapsed ? 'is-collapsed' : ''}`}
            />
            <span className="code-block-lang-label">
              {isCollapsed ? 'Show code' : 'Hide code'}
            </span>
            {isLiveRunning ? (
              <span className="code-live-pill">
                <span className="spinner spinner-small" />
                <span>Running…</span>
              </span>
            ) : null}
            {isModified ? (
              <span className="code-block-edited-tag" title="Modified from original">
                edited
              </span>
            ) : null}
          </button>

          <div className="code-block-actions">
            {sessionActions && isExecutable ? (
              <button
                type="button"
                className={`code-tool-btn ${isAskingAgent ? 'is-active-btn' : ''}`}
                onClick={() => setIsAskingAgent((prev) => !prev)}
                title="Ask agent to edit or fix this code"
              >
                <SendIcon size={11} />
                <span>Ask to edit</span>
              </button>
            ) : null}

            {isExecutable ? (
              <button
                type="button"
                className={`code-tool-btn ${isEditing ? 'is-active-btn' : ''}`}
                onClick={handleToggleEdit}
                title={isEditing ? 'Done editing' : 'Edit code in place'}
              >
                {isEditing ? <CheckIcon size={11} /> : <PencilIcon size={11} />}
                <span>{isEditing ? 'Done' : 'Edit'}</span>
              </button>
            ) : null}

            {isModified ? (
              <button
                type="button"
                className="code-tool-btn"
                onClick={handleReset}
                title="Reset to original code"
              >
                <RefreshIcon size={11} />
                <span>Reset</span>
              </button>
            ) : null}

            {sessionActions && isExecutable ? (
              <button
                type="button"
                className={`code-run-btn ${isLiveRunning ? 'is-running' : ''}`}
                onClick={handleRun}
                disabled={isLiveRunning || (isPython && sessionState?.pythonStatus === 'running')}
                title="Execute code and display results below (Ctrl+Enter)"
              >
                <PlayIcon size={11} />
                <span>{isLiveRunning ? 'Running…' : 'Run'}</span>
              </button>
            ) : null}

            <button
              type="button"
              className="code-copy-btn"
              onClick={() => handleCopy(displayCode, setCopied)}
              title="Copy code to clipboard"
            >
              {copied ? <CheckIcon size={11} /> : <CopyIcon size={11} />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
        </div>

        {/* Inline "Ask Agent to Edit" Prompt Bar */}
        {isAskingAgent ? (
          <form className="code-ask-bar" onSubmit={handleAskAgentSubmit}>
            <input
              ref={askInputRef}
              type="text"
              className="code-ask-input"
              placeholder="Tell the agent what to change or fix in this code…"
              value={askPrompt}
              onChange={(e) => setAskPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setIsAskingAgent(false)
                  setAskPrompt('')
                }
              }}
              disabled={sessionState?.isStreaming}
            />
            <button
              type="submit"
              className="code-ask-submit-btn"
              disabled={!askPrompt.trim() || sessionState?.isStreaming}
            >
              <SendIcon size={11} />
              <span>Send</span>
            </button>
            <button
              type="button"
              className="code-ask-cancel-btn"
              onClick={() => {
                setIsAskingAgent(false)
                setAskPrompt('')
              }}
            >
              Cancel
            </button>
          </form>
        ) : null}

        {/* Collapsible Code Dropdown Body — Flush bottom with 0 empty trailing lines */}
        {!isCollapsed ? (
          <div className="code-block-body">
            {isEditing ? (
              <div className="code-editor-wrapper">
                <div className="code-block-gutter" aria-hidden>
                  {editorLines.map((_, i) => (
                    <span key={i} className="code-line-num">
                      {i + 1}
                    </span>
                  ))}
                </div>
                <div className="code-editor-input-area">
                  <textarea
                    ref={textareaRef}
                    className="code-editor-textarea"
                    value={currentCode}
                    onChange={(e) => setCurrentCode(e.target.value)}
                    onKeyDown={handleKeyDown}
                    spellCheck={false}
                    autoCapitalize="off"
                    autoComplete="off"
                    aria-label="Code editor"
                  />
                </div>
              </div>
            ) : (
              <div className="code-display-wrapper">
                <div className="code-block-gutter" aria-hidden>
                  {displayLines.map((_, i) => (
                    <span key={i} className="code-line-num">
                      {i + 1}
                    </span>
                  ))}
                </div>
                <pre className="code-block-pre">
                  <CodeHighlight code={displayCode} language={rawLang} />
                </pre>
              </div>
            )}
          </div>
        ) : null}
      </div>

      {/* Figures, Tables, and Outputs Displayed Cleanly Under the Code Wrapper */}
      {hasUnderOutputs ? (
        <div className="code-under-outputs">
          {/* Compact 1-line error notice (only when user manually runs code with an issue) */}
          {activeError ? (
            <div className="code-under-error">
              <span className="code-under-error-text">{activeError}</span>
              {sessionActions ? (
                <button
                  type="button"
                  className="code-under-error-btn"
                  onClick={() => {
                    setIsAskingAgent(true)
                    if (!askPrompt) {
                      setAskPrompt(`Fix this ${languageLabel} issue: ${activeError}`)
                    }
                  }}
                >
                  <PencilIcon size={11} />
                  <span>Ask agent to edit</span>
                </button>
              ) : null}
            </div>
          ) : null}

          {/* Generated Figures / Plots */}
          {activeImages.length > 0 ? (
            <div className={`code-under-figures ${activeImages.length >= 2 ? 'is-multi' : ''}`}>
              {activeImages.map((dataUrl, idx) => (
                <div key={idx} className="code-figure-card">
                  <div className="code-figure-head">
                    <span className="code-figure-title">
                      {activeImages.length === 1 && purpose ? purpose : `Figure ${idx + 1}`}
                    </span>
                    <div className="code-figure-actions">
                      <button
                        type="button"
                        className="tool-btn"
                        onClick={() => handleCopyImage(dataUrl, idx)}
                        title="Copy figure image to clipboard"
                      >
                        {copiedImgIdx === idx ? <CheckIcon size={11} /> : <CopyIcon size={11} />}
                        <span>{copiedImgIdx === idx ? 'Copied' : 'Copy'}</span>
                      </button>
                      <button
                        type="button"
                        className="tool-btn"
                        onClick={() => setLightboxImg({ url: dataUrl, index: idx })}
                        title="Zoom figure in full screen"
                      >
                        <ExternalIcon size={11} />
                        <span>Zoom</span>
                      </button>
                      <button
                        type="button"
                        className="tool-btn"
                        onClick={() => handleDownloadImage(dataUrl, idx)}
                        title="Download high-resolution PNG"
                      >
                        <DownloadIcon size={11} />
                        <span>PNG</span>
                      </button>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="code-figure-img-btn"
                    onClick={() => setLightboxImg({ url: dataUrl, index: idx })}
                    title="Click to inspect full size"
                  >
                    <img
                      src={dataUrl}
                      alt={purpose || `Generated figure ${idx + 1}`}
                      className="code-figure-img"
                      loading="lazy"
                    />
                  </button>
                </div>
              ))}
            </div>
          ) : null}

          {/* Result Table (from SQL query or Python DataFrame) */}
          {activeTable && activeTable.headers.length > 0 && activeTable.rows.length > 0 ? (
            <div className="code-under-table">
              <DataTable
                headers={activeTable.headers}
                rows={activeTable.rows}
                totalRows={activeTable.totalRows}
              />
            </div>
          ) : null}

          {/* Console Output (when printed text exists without a table, or alongside figures) */}
          {activeStdout && (!activeTable || activeTable.rows.length === 0) ? (
            <div className="code-under-stdout">
              <div className="code-under-stdout-head">
                <span>Output</span>
                <button
                  type="button"
                  className="tool-btn"
                  onClick={() => handleCopy(activeStdout, setCopiedStdout)}
                >
                  {copiedStdout ? <CheckIcon size={11} /> : <CopyIcon size={11} />}
                  <span>{copiedStdout ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <pre className="code-under-stdout-pre">{activeStdout}</pre>
            </div>
          ) : null}
        </div>
      ) : null}

      <FigureLightbox
        src={lightboxImg?.url ?? null}
        title={
          lightboxImg
            ? purpose || `Figure ${lightboxImg.index + 1}`
            : ''
        }
        onDownload={
          lightboxImg
            ? () => handleDownloadImage(lightboxImg.url, lightboxImg.index)
            : undefined
        }
        onClose={() => setLightboxImg(null)}
      />
    </div>
  )
}
