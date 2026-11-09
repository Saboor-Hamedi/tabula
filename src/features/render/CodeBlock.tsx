import { useState, useRef, useEffect, type KeyboardEvent } from 'react'
import type { PythonExecutionResult } from '../../core/python/types'
import {
  CheckIcon,
  CopyIcon,
  PencilIcon,
  PlayIcon,
  RefreshIcon,
  SendIcon,
} from '../common/Icons'
import { useSessionActions, useSessionState } from '../SessionProvider'
import { CodeHighlight } from './CodeHighlight'

interface CodeBlockProps {
  code: string
  className?: string
}

interface CodeCellProps {
  id: string
  title?: string
  initialCode: string
  language: string
  isPython: boolean
}

function CodeCellEditor({
  initialCode,
  language,
  isPython,
}: CodeCellProps) {
  const { runPythonCode, sendMessage } = useSessionActions()
  const { pythonStatus, pythonResult } = useSessionState()

  // Editing state
  const [currentCode, setCurrentCode] = useState(initialCode)
  const [isEditing, setIsEditing] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Status state
  const [copied, setCopied] = useState(false)
  const [runningThis, setRunningThis] = useState(false)
  const [localResult, setLocalResult] = useState<PythonExecutionResult | null>(null)
  const [askingFix, setAskingFix] = useState(false)

  const isModified = currentCode.trim() !== initialCode.trim()
  const lines = currentCode.split('\n')
  const lineCount = lines.length

  // Sync initialCode changes
  useEffect(() => {
    setCurrentCode(initialCode)
  }, [initialCode])

  // Focus textarea when entering edit mode
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [isEditing])

  // Auto-resize textarea to exactly match code lines with 0 bottom gap
  useEffect(() => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      const targetHeight = Math.max(lines.length * 18, 18) + 16
      textarea.style.height = `${Math.max(textarea.scrollHeight, targetHeight)}px`
    }
  }, [currentCode, isEditing, lines.length])

  const handleCopy = async (text: string, setter: (v: boolean) => void) => {
    try {
      await navigator.clipboard.writeText(text)
      setter(true)
      window.setTimeout(() => setter(false), 1600)
    } catch {
      // Ignore clipboard failure
    }
  }

  const handleRun = async () => {
    setRunningThis(true)
    try {
      // Automatically opens right panel and displays the results there!
      const res = await runPythonCode(currentCode, { openPanel: true })
      setLocalResult(res)
    } catch (err) {
      setLocalResult({
        code: currentCode,
        stdout: '',
        stderr: '',
        images: [],
        elapsedMs: 0,
        error: err instanceof Error ? err.message : 'Execution failed.',
        executedAt: Date.now(),
      })
    } finally {
      setRunningThis(false)
    }
  }

  const handleReset = () => {
    setCurrentCode(initialCode)
  }

  const handleAskAgentToFix = async (errorMessage: string) => {
    setAskingFix(true)
    try {
      const fixPrompt = `The Python script encountered an error:\n\`\`\`python\n${currentCode}\n\`\`\`\nError:\n\`\`\`\n${errorMessage}\n\`\`\`\nPlease fix the script so it runs cleanly on my dataset.`
      await sendMessage(fixPrompt)
    } finally {
      setAskingFix(false)
    }
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
      const spaces = '    '

      if (e.shiftKey) {
        const before = currentCode.substring(0, start)
        const lineStart = before.lastIndexOf('\n') + 1
        if (currentCode.substring(lineStart, lineStart + 4) === spaces) {
          const next =
            currentCode.substring(0, lineStart) + currentCode.substring(lineStart + 4)
          setCurrentCode(next)
          requestAnimationFrame(() => {
            textarea.selectionStart = Math.max(lineStart, start - 4)
            textarea.selectionEnd = Math.max(lineStart, end - 4)
          })
        }
      } else {
        const next =
          currentCode.substring(0, start) + spaces + currentCode.substring(end)
        setCurrentCode(next)
        requestAnimationFrame(() => {
          textarea.selectionStart = textarea.selectionEnd = start + 4
        })
      }
    }
  }

  const isCurrentRun = Boolean(pythonResult && pythonResult.code.trim() === currentCode.trim())
  const resultToDisplay = localResult || (isCurrentRun ? pythonResult : null)

  return (
    <div
      className={`code-block-container ${isPython ? 'is-python' : ''} ${isEditing ? 'is-editing-mode' : ''}`}
    >
      {/* Sticky Header Bar - subtle, zero border radius */}
      <div className="code-block-header">
        <div className="code-block-lang-group">
          {isPython ? (
            <span className="python-badge-icon" aria-hidden title="Python 3.12 (Pyodide WASM)">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                <path d="M10 8h4a2 2 0 0 1 2 2v2H8V10a2 2 0 0 1 2-2z" fill="#3b82f6" />
                <path d="M14 16h-4a2 2 0 0 1-2-2v-2h8v2a2 2 0 0 1-2 2z" fill="#eab308" />
              </svg>
            </span>
          ) : null}

          <span className="code-block-lang-label">{language || 'code'}</span>

          <span className="code-block-line-count">
            {lineCount} {lineCount === 1 ? 'line' : 'lines'}
          </span>

          {isModified ? (
            <span className="code-block-edited-tag" title="Modified from original code">
              edited
            </span>
          ) : null}
        </div>

        <div className="code-block-actions">
          {/* Execution status in header */}
          {resultToDisplay && !runningThis ? (
            <span
              className={`code-status-pill ${resultToDisplay.error ? 'is-error' : 'is-success'}`}
              title={
                resultToDisplay.error
                  ? 'Execution failed (see right panel)'
                  : `Executed in ${resultToDisplay.elapsedMs}ms (see right panel)`
              }
            >
              {resultToDisplay.error ? 'Error' : `${resultToDisplay.elapsedMs}ms`}
            </span>
          ) : null}

          {/* Ask AI to fix button in header if error */}
          {resultToDisplay?.error && !runningThis ? (
            <button
              type="button"
              className="code-tool-btn is-fix-btn"
              onClick={() => handleAskAgentToFix(resultToDisplay.error || '')}
              disabled={askingFix}
              title="Send error to AI to generate a fix"
            >
              <SendIcon size={11} />
              <span>{askingFix ? 'Asking…' : 'Fix'}</span>
            </button>
          ) : null}

          {/* Edit / Done button */}
          {isPython ? (
            <button
              type="button"
              className={`code-tool-btn ${isEditing ? 'is-active-btn' : ''}`}
              onClick={() => setIsEditing((prev) => !prev)}
              title={isEditing ? 'Done editing' : 'Edit code in place'}
            >
              {isEditing ? <CheckIcon size={11} /> : <PencilIcon size={11} />}
              <span>{isEditing ? 'Done' : 'Edit'}</span>
            </button>
          ) : null}

          {/* Reset button (visible when edited) */}
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

          {/* Run button - subtle, only "Run" */}
          {isPython ? (
            <button
              type="button"
              className={`code-run-btn ${runningThis ? 'is-running' : ''}`}
              onClick={handleRun}
              disabled={pythonStatus === 'running'}
              title="Execute in Pyodide WASM and display on right panel (Ctrl+Enter)"
            >
              <PlayIcon size={11} />
              <span>{runningThis ? 'Running…' : 'Run'}</span>
            </button>
          ) : null}

          {/* Copy code button */}
          <button
            type="button"
            className="code-copy-btn"
            onClick={() => handleCopy(currentCode, setCopied)}
            title="Copy code to clipboard"
          >
            {copied ? <CheckIcon size={11} /> : <CopyIcon size={11} />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>
      </div>

      {/* Code Editor Body / Display - flush with 0 bottom gap */}
      <div className="code-block-body">
        {isEditing ? (
          <div className="code-editor-wrapper">
            <div className="code-block-gutter" aria-hidden>
              {lines.map((_, i) => (
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
              {lines.map((_, i) => (
                <span key={i} className="code-line-num">
                  {i + 1}
                </span>
              ))}
            </div>
            <pre className="code-block-pre">
              <CodeHighlight code={currentCode} language={language} />
            </pre>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Top-Level Code Block Wrapper.
 * Clean, subtle, zero border-radius.
 */
export function CodeBlock({ code, className }: CodeBlockProps) {
  const language = className ? className.replace(/^language-/, '').toLowerCase() : ''
  const isPython = language === 'python' || language === 'py'

  return (
    <div className="code-block-root">
      <CodeCellEditor
        id="main"
        initialCode={code}
        language={language}
        isPython={isPython}
      />
    </div>
  )
}
