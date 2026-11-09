import { formatCount } from '../../core/utils/format'
import { ActivityIcon, CloseIcon, DownloadIcon, PrinterIcon } from '../common/Icons'
import { IconButton } from '../common/IconButton'
import { useSessionActions, useSessionState } from '../SessionProvider'
import { StickyBoard } from '../theme'
import { TraceEntry } from '../trace/TraceEntry'
import { PythonPanel } from './PythonPanel'

/**
 * Right-hand inspector.
 *
 * NotebookLM-style workspace panel featuring:
 * - Notes & Studio (interactive sticky notes & stickers)
 * - Python (analysis runtime results & plots)
 * - Activity (transparent agent trace)
 * - Print & Export controls
 */

export function Inspector() {
  const {
    panelTab,
    traces,
    activeSession,
    messages,
    isStreaming,
    streamingSessionId,
    pythonResult,
    pythonStatus,
  } = useSessionState()
  const { setPanelTab, closePanel, exportTrace, exportTranscript } = useSessionActions()

  const streamingHere = isStreaming && streamingSessionId === activeSession?.id

  const handleExport = () => {
    if (panelTab === 'notes') {
      try {
        const raw = localStorage.getItem('tabula-sticky-notes:v1')
        const items = raw ? (JSON.parse(raw) as Array<{ kind: string; text?: string; color?: string }>) : []
        const validNotes = items.filter((i) => i.kind === 'note' && i.text?.trim())
        if (validNotes.length === 0 && messages.length > 0) {
          exportTranscript()
          return
        }
        let content = `# Tabula Studio Notes\n\nExported on ${new Date().toLocaleString()}\n\n`
        if (validNotes.length === 0) {
          content += '_No notes currently on the board._\n'
        } else {
          validNotes.forEach((item, index) => {
            content += `### Note ${index + 1} (${item.color || 'yellow'})\n${item.text}\n\n`
          })
        }
        const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `tabula-notes-${new Date().toISOString().slice(0, 10)}.md`
        link.click()
        URL.revokeObjectURL(url)
      } catch (err) {
        console.error('Failed to export notes', err)
      }
    } else if (panelTab === 'trace') {
      exportTrace()
    } else if (panelTab === 'python') {
      if (pythonResult?.code) {
        const blob = new Blob([pythonResult.code], { type: 'text/x-python;charset=utf-8' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `tabula-analysis-${new Date().toISOString().slice(0, 10)}.py`
        link.click()
        URL.revokeObjectURL(url)
      }
    }
  }

  return (
    <aside className="inspector" aria-label="Inspector">
      <div className="inspector-head">
        <div className="inspector-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={panelTab === 'notes'}
            className={`inspector-tab ${panelTab === 'notes' ? 'is-active' : ''}`}
            onClick={() => setPanelTab('notes')}
          >
            Notes
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={panelTab === 'python'}
            className={`inspector-tab ${panelTab === 'python' ? 'is-active' : ''}`}
            onClick={() => setPanelTab('python')}
          >
            Python
            {pythonStatus === 'running' ? (
              <span className="inspector-tab-count is-pulse">●</span>
            ) : pythonResult?.images.length ? (
              <span className="inspector-tab-count">{pythonResult.images.length}</span>
            ) : null}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={panelTab === 'trace'}
            className={`inspector-tab ${panelTab === 'trace' ? 'is-active' : ''}`}
            onClick={() => setPanelTab('trace')}
          >
            Activity
            {traces.length > 0 ? (
              <span className="inspector-tab-count">{formatCount(traces.length)}</span>
            ) : null}
          </button>
        </div>

        <div className="inspector-head-actions">
          <IconButton label="Print workspace" size="sm" onClick={() => window.print()}>
            <PrinterIcon size={15} />
          </IconButton>
          <IconButton label="Export panel" size="sm" onClick={handleExport}>
            <DownloadIcon size={15} />
          </IconButton>
          <IconButton label="Close inspector" size="sm" onClick={() => closePanel()}>
            <CloseIcon size={15} />
          </IconButton>
        </div>
      </div>

      <div
        className={`inspector-body ${
          panelTab === 'python'
            ? 'is-python-tab'
            : panelTab === 'notes'
            ? 'is-notes-tab'
            : ''
        }`}
      >
        {panelTab === 'notes' ? (
          <StickyBoard />
        ) : panelTab === 'python' ? (
          <PythonPanel />
        ) : traces.length === 0 ? (
          <div className="panel-empty">
            <ActivityIcon size={22} />
            <p>No activity yet</p>
            <span>Ask a question and each column check and analysis step shows up here.</span>
          </div>
        ) : (
          <div className="trace-list">
            {streamingHere ? <div className="trace-live">Live</div> : null}
            {traces.map((entry) => (
              <TraceEntry key={entry.id} entry={entry} />
            ))}
          </div>
        )}
      </div>
    </aside>
  )
}
