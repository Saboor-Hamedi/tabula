import { formatCount } from '../../core/utils/format'
import { ActivityIcon, CloseIcon, DownloadIcon, PdfIcon } from '../common/Icons'
import { IconButton } from '../common/IconButton'
import { useSessionActions, useSessionState } from '../SessionProvider'
import { StickyBoard } from '../theme'
import { TraceEntry } from '../trace/TraceEntry'
import { PythonPanel } from './PythonPanel'

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Right-hand inspector.
 *
 * NotebookLM-style workspace panel featuring:
 * - Notes (interactive 3-column studio notes)
 * - Results (Python runtime results & plots)
 * - Activity (transparent agent trace)
 * - PDF Download & Export controls
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

  const handleDownloadPdf = () => {
    let bodyHtml = ''
    let docTitle = 'Analysis Report'

    if (panelTab === 'notes') {
      docTitle = 'Studio Notes'
      try {
        const raw = localStorage.getItem('tabula-sticky-notes:v1')
        const items = raw ? (JSON.parse(raw) as Array<{ kind: string; text?: string; color?: string }>) : []
        const validNotes = items.filter((i) => i.kind === 'note' && i.text?.trim())

        if (validNotes.length === 0) {
          bodyHtml = '<p style="color:#6b7280;font-style:italic;">No notes recorded on the board.</p>'
        } else {
          bodyHtml = `
            <div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:16px;">
              ${validNotes
                .map(
                  (n, idx) => `
                <div style="border:1px solid #e5e7eb;border-radius:10px;padding:16px;background:#fdfcf8;box-shadow:0 1px 3px rgba(0,0,0,0.05);break-inside:avoid;">
                  <div style="font-size:10px;font-weight:700;text-transform:uppercase;color:#9ca3af;margin-bottom:8px;">Note ${idx + 1}</div>
                  <div style="font-size:13px;color:#1f2937;white-space:pre-wrap;line-height:1.5;">${escapeHtml(n.text || '')}</div>
                </div>
              `,
                )
                .join('')}
            </div>
          `
        }
      } catch {
        bodyHtml = '<p>Unable to load notes.</p>'
      }
    } else if (panelTab === 'python') {
      docTitle = 'Analysis Results'
      if (pythonResult) {
        const plotsHtml = pythonResult.images
          .map(
            (img) => `
          <div style="margin:20px 0;text-align:center;break-inside:avoid;">
            <img src="data:image/png;base64,${img}" style="max-width:100%;border-radius:8px;border:1px solid #e5e7eb;" />
          </div>
        `,
          )
          .join('')

        const outputHtml = pythonResult.stdout
          ? `<pre style="background:#f8fafc;padding:12px;border-radius:8px;border:1px solid #e2e8f0;font-size:12px;overflow:auto;margin:12px 0;">${escapeHtml(pythonResult.stdout)}</pre>`
          : ''

        const codeHtml = pythonResult.code
          ? `<pre style="background:#1e293b;color:#f8fafc;padding:14px;border-radius:8px;font-size:12px;overflow:auto;margin:12px 0;">${escapeHtml(pythonResult.code)}</pre>`
          : ''

        bodyHtml = `
          ${plotsHtml}
          ${outputHtml ? `<h3 style="font-size:14px;margin-top:20px;">Console Output</h3>${outputHtml}` : ''}
          ${codeHtml ? `<h3 style="font-size:14px;margin-top:20px;">Execution Code</h3>${codeHtml}` : ''}
        `
      } else {
        bodyHtml = '<p style="color:#6b7280;font-style:italic;">No execution results recorded.</p>'
      }
    } else {
      docTitle = 'Activity Audit'
      bodyHtml = `
        <div style="font-size:13px;line-height:1.6;">
          ${traces
            .map(
              (t) => `
            <div style="border-bottom:1px solid #e5e7eb;padding:8px 0;break-inside:avoid;">
              <strong>${escapeHtml(t.toolName)}</strong> <span style="color:#6b7280;font-size:11px;">[${escapeHtml(t.status)}]</span>
            </div>
          `,
            )
            .join('')}
        </div>
      `
    }

    const printableDoc = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(docTitle)}</title>
  <style>
    @page { margin: 12mm; size: auto; }
    @media print {
      body { margin: 0; padding: 0; }
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #111827;
      background: #ffffff;
      padding: 24px;
      margin: 0;
      line-height: 1.5;
    }
    h1 { font-size: 20px; font-weight: 700; margin: 0 0 4px; }
    .meta { font-size: 11px; color: #6b7280; margin-bottom: 24px; border-bottom: 1px solid #e5e7eb; padding-bottom: 12px; }
  </style>
</head>
<body>
  <h1>${escapeHtml(docTitle)}</h1>
  <div class="meta">Generated on ${new Date().toLocaleString(undefined, { dateStyle: 'long', timeStyle: 'short' })}</div>
  ${bodyHtml}
</body>
</html>`

    const iframe = document.createElement('iframe')
    iframe.style.position = 'fixed'
    iframe.style.right = '0'
    iframe.style.bottom = '0'
    iframe.style.width = '0'
    iframe.style.height = '0'
    iframe.style.border = '0'
    document.body.appendChild(iframe)

    const doc = iframe.contentWindow?.document
    if (doc) {
      doc.open()
      doc.write(printableDoc)
      doc.close()
      iframe.contentWindow?.focus()
      setTimeout(() => {
        iframe.contentWindow?.print()
        setTimeout(() => {
          document.body.removeChild(iframe)
        }, 1000)
      }, 250)
    }
  }

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
            Results
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
          <IconButton label="Download PDF" size="sm" onClick={handleDownloadPdf}>
            <PdfIcon size={15} />
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
            <div className="panel-empty-icon" aria-hidden>
              <ActivityIcon size={24} />
            </div>
            <div className="panel-empty-title">No activity yet</div>
            <div className="panel-empty-desc">
              When the assistant queries DuckDB or executes Python, tool calls and schema inspections will appear here.
            </div>
          </div>
        ) : (
          <div className="trace-list">
            <div className="trace-list-meta">
              <span>{formatCount(traces.length)} operations</span>
              {streamingHere && <span className="trace-pulse">Active</span>}
            </div>
            {traces.map((trace) => (
              <TraceEntry key={trace.id} entry={trace} />
            ))}
          </div>
        )}
      </div>
    </aside>
  )
}
