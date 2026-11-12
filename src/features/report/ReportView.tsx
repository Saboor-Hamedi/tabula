import { useRef } from 'react'
import { buildReportHtml, downloadHtml } from '../../core/export/report'
import { formatCount } from '../../core/utils/format'
import { CloseIcon, DownloadIcon, PrintIcon } from '../common/Icons'
import { IconButton } from '../common/IconButton'
import { Renderer } from '../chat'
import { useSessionActions, useSessionState } from '../SessionProvider'

/** Full-width report view with print and standalone HTML export. */
export function ReportView() {
  const { activeSession, messages } = useSessionState()
  const { closeReport } = useSessionActions()
  const bodyRef = useRef<HTMLDivElement>(null)

  if (!activeSession) return null

  const title = activeSession.primaryTable
    ? `${activeSession.primaryTable} Analysis Report`
    : 'Dataset Analysis Report'
  const subtitle = `Tabula analysis · ${new Date().toLocaleString()} · ${formatCount(messages.length)} messages`
  const fileName = `tabula-analysis-report-${new Date().toISOString().slice(0, 10)}.html`

  const getHtml = () =>
    buildReportHtml({
      title,
      subtitle,
      body: bodyRef.current?.innerHTML ?? '',
    })

  const handlePrint = () => {
    const printWindow = window.open('', '_blank')
    if (!printWindow) return
    printWindow.document.write(getHtml())
    printWindow.document.close()
    printWindow.focus()
    printWindow.print()
  }

  return (
    <div className="report-overlay">
      <div className="report-shell">
        <header className="report-toolbar">
          <div>
            <strong>Report</strong>
            <span>{subtitle}</span>
          </div>
          <div className="report-toolbar-actions">
            <button type="button" className="btn btn-ghost btn-small" onClick={handlePrint}>
              <PrintIcon size={14} />
              <span>Print / PDF</span>
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-small"
              onClick={() => downloadHtml(fileName, getHtml())}
            >
              <DownloadIcon size={14} />
              <span>Download</span>
            </button>
            <IconButton label="Close report" size="sm" onClick={closeReport}>
              <CloseIcon size={16} />
            </IconButton>
          </div>
        </header>

        <div className="report-scroll">
          <article className="report-document" ref={bodyRef}>
            <h1>{title}</h1>
            <div className="report-subtitle">{subtitle}</div>
            {messages.map((message) =>
              !message.content.trim() ? null : (
                <section key={message.id} className="report-entry">
                  <div className={message.role === 'user' ? 'report-user' : 'report-assistant'}>
                    {message.role === 'user' ? 'You' : 'Tabula'}
                  </div>
                  {message.role === 'user' ? (
                    <p>{message.content}</p>
                  ) : (
                    <Renderer content={message.content} />
                  )}
                </section>
              ),
            )}
          </article>
        </div>
      </div>
    </div>
  )
}
