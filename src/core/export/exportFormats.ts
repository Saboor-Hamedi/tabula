import type { ChatMessage, Session } from '../../core/types'
import { formatCount } from '../../core/utils/format'

function getBaseFileName(fileName: string): string {
  return fileName.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_')
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

/**
 * Parses markdown tables into clean HTML table markup.
 */
function markdownTablesToHtml(md: string): string {
  const tableRegex = /((?:\|[^\n]+\|\r?\n)+)/g
  return md.replace(tableRegex, (match) => {
    const rawLines = match.trim().split(/\r?\n/)
    if (rawLines.length < 2) return match

    const headerLine = rawLines[0]
    const separatorLine = rawLines[1]
    if (!separatorLine.includes('-') || !separatorLine.includes('|')) return match

    const parseCells = (line: string) =>
      line
        .replace(/^\|/, '')
        .replace(/\|$/, '')
        .split('|')
        .map((c) => c.trim())

    const headers = parseCells(headerLine)
    const bodyLines = rawLines.slice(2)

    let html = '<table style="border-collapse:collapse;width:100%;margin:12pt 0;font-size:9.5pt;border:1pt solid #cbd5e1;">'
    html += '<thead><tr style="background:#f1f5f9;">'
    headers.forEach((h) => {
      html += `<th style="border:1pt solid #cbd5e1;padding:6pt 10pt;text-align:left;font-weight:600;color:#0f172a;">${escapeHtml(h)}</th>`
    })
    html += '</tr></thead><tbody>'

    bodyLines.forEach((line) => {
      if (!line.trim()) return
      const cells = parseCells(line)
      html += '<tr>'
      cells.forEach((c) => {
        html += `<td style="border:1pt solid #cbd5e1;padding:6pt 10pt;color:#334155;">${escapeHtml(c)}</td>`
      })
      html += '</tr>'
    })

    html += '</tbody></table>'
    return html
  })
}

/**
 * Converts markdown formatting to clean HTML with tables, headings, bold, code.
 */
function markdownToExecutiveHtml(md: string): string {
  let html = markdownTablesToHtml(md)

  html = html.replace(/```([a-z]*)\r?\n([\s\S]*?)```/g, (_match, _lang, code) => {
    return `<pre style="background:#f8fafc;padding:10pt;border:1pt solid #e2e8f0;border-radius:4px;font-family:Consolas,monospace;font-size:9pt;margin:10pt 0;overflow-x:auto;">${escapeHtml(code.trim())}</pre>`
  })

  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>')
  html = html.replace(/`([^`]+)`/g, '<code style="background:#f1f5f9;padding:2pt 4pt;font-family:Consolas,monospace;font-size:9pt;border-radius:3px;">$1</code>')

  html = html.replace(/^### (.*$)/gim, '<h3 style="color:#0f766e;font-size:12pt;font-weight:700;margin:12pt 0 4pt 0;">$1</h3>')
  html = html.replace(/^## (.*$)/gim, '<h2 style="color:#0f766e;font-size:14pt;font-weight:700;margin:14pt 0 6pt 0;">$1</h2>')
  html = html.replace(/^# (.*$)/gim, '<h1 style="color:#0f766e;font-size:16pt;font-weight:800;margin:16pt 0 6pt 0;">$1</h1>')

  html = html.replace(/^\s*[-*]\s+(.*$)/gim, '<li style="margin-bottom:3pt;">$1</li>')
  html = html.replace(/(<li.*<\/li>)/gms, '<ul style="padding-left:18pt;margin:6pt 0 10pt 0;">$1</ul>')

  const blocks = html.split(/\n\n+/)
  return blocks
    .map((block) => {
      const trimmed = block.trim()
      if (!trimmed) return ''
      if (
        trimmed.startsWith('<h') ||
        trimmed.startsWith('<pre') ||
        trimmed.startsWith('<table') ||
        trimmed.startsWith('<ul') ||
        trimmed.startsWith('<ol')
      ) {
        return trimmed
      }
      return `<p style="margin:0 0 8pt 0;line-height:1.6;color:#1e293b;">${trimmed.replace(/\n/g, '<br/>')}</p>`
    })
    .join('\n')
}

function cleanMarkdownForText(md: string): string {
  return md
    .replace(/```[a-z]*\r?\n([\s\S]*?)```/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/^#+\s+/gm, '')
    .replace(/<[^>]*>/g, '')
    .trim()
}

/**
 * Extracts and cleans the rendered HTML message content from the live DOM.
 * Preserves vector SVGs (Mermaid diagrams) and formatted tables while removing interactive toolbars.
 */
function extractMessageContentHtml(msgIndex: number, rawFallback: string): string {
  const domMessages = Array.from(document.querySelectorAll('.chat-column .message'))
  const assistantDoms = domMessages.filter((el) => el.classList.contains('message-assistant'))
  const matchingDom = assistantDoms[msgIndex]

  if (matchingDom) {
    const contentDom = matchingDom.querySelector('.message-content')
    if (contentDom) {
      const clone = contentDom.cloneNode(true) as HTMLElement
      // Remove interactive toolbar buttons, copy icons, editor tabs
      clone
        .querySelectorAll('.message-tools, .diagram-tabs, .diagram-toolbar, .cell-copy-btn, .table-action-btn, button')
        .forEach((el) => el.remove())

      // Ensure tables are styled
      clone.querySelectorAll('table').forEach((tbl) => {
        tbl.setAttribute('style', 'width:100%;border-collapse:collapse;margin:12pt 0;font-size:9.5pt;border:1pt solid #cbd5e1;')
      })
      clone.querySelectorAll('th, td').forEach((cell) => {
        ;(cell as HTMLElement).setAttribute('style', 'border:1pt solid #cbd5e1;padding:6pt 10pt;text-align:left;')
      })
      clone.querySelectorAll('th').forEach((th) => {
        ;(th as HTMLElement).setAttribute('style', 'border:1pt solid #cbd5e1;padding:6pt 10pt;text-align:left;background:#f1f5f9;font-weight:bold;color:#334155;')
      })

      // Ensure SVGs have visible styling and fit the page
      clone.querySelectorAll('svg').forEach((svg) => {
        svg.setAttribute('style', 'max-width:100%;height:auto;display:block;margin:12pt auto;')
      })

      return clone.innerHTML
    }
  }

  return markdownToExecutiveHtml(rawFallback)
}

/**
 * Robust Executive PDF Export.
 *
 * Captures live rendered vector SVGs and HTML tables directly from the transcript,
 * generates a pristine high-resolution executive document, and triggers the browser's
 * native vector print engine (Save as PDF).
 *
 * Never fails with canvas taint errors or blank images.
 */
export function exportAnalysisAsPdf(session: Session, messages: ChatMessage[]): void {
  const title = `${session.fileName} — Executive Analysis Report`
  const dateStr = new Date().toLocaleString()
  const totalRows = (session.tables ?? []).reduce((sum, t) => sum + (t.rowCount || 0), 0)

  const validMessages = messages.filter((m) => m.content && m.content.trim().length > 0)

  let assistantCount = 0
  const entriesHtml = validMessages
    .map((msg, idx) => {
      const isUser = msg.role === 'user'
      let bodyHtml = ''

      if (isUser) {
        bodyHtml = `<div style="font-weight:600;font-size:11pt;color:#0f172a;">${escapeHtml(msg.content)}</div>`
      } else {
        bodyHtml = extractMessageContentHtml(assistantCount++, msg.content)
      }

      return `
        <div class="entry ${isUser ? 'entry-user' : 'entry-tabula'}">
          <div class="entry-header">
            <span class="entry-role">${isUser ? `Inquiry #${Math.floor(idx / 2) + 1}` : `Analysis & Finding #${Math.floor(idx / 2) + 1}`}</span>
            <span class="entry-speaker">${isUser ? 'User Prompt' : 'Tabula Analytical Findings'}</span>
          </div>
          <div class="entry-body">
            ${bodyHtml}
          </div>
        </div>
      `
    })
    .join('\n')

  const printableHtml = `<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>${escapeHtml(title)}</title>
  <style>
    @page {
      size: A4;
      margin: 16mm 14mm 16mm 14mm;
      @bottom-right {
        content: counter(page);
        font-size: 8.5pt;
        color: #94a3b8;
      }
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 24px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      background: #ffffff;
      font-size: 10.5pt;
      line-height: 1.6;
    }
    .report-header {
      border-bottom: 2.5px solid #0f766e;
      padding-bottom: 14px;
      margin-bottom: 22px;
    }
    .report-brand-row {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      margin-bottom: 6px;
    }
    .report-brand {
      font-size: 11pt;
      font-weight: 700;
      color: #0f766e;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }
    .report-badge {
      font-size: 9pt;
      font-weight: 600;
      color: #0f766e;
      background: #ccfbf1;
      padding: 2px 8px;
      border-radius: 999px;
    }
    .report-title {
      font-size: 20pt;
      font-weight: 800;
      color: #0f172a;
      letter-spacing: -0.02em;
      margin: 0 0 16px 0;
    }
    .metadata-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 12px 14px;
    }
    .meta-item {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .meta-label {
      font-size: 8pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #64748b;
    }
    .meta-value {
      font-size: 10pt;
      font-weight: 600;
      color: #0f172a;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .entry {
      margin-bottom: 20px;
      page-break-inside: avoid;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      overflow: hidden;
      background: #ffffff;
    }
    .entry-user {
      border-left: 4px solid #0f766e;
    }
    .entry-tabula {
      border-left: 4px solid #0284c7;
    }
    .entry-header {
      background: #f8fafc;
      border-bottom: 1px solid #e2e8f0;
      padding: 8px 14px;
      display: flex;
      justify-content: space-between;
      font-size: 9.5pt;
    }
    .entry-role {
      font-weight: 700;
      color: #0f766e;
    }
    .entry-tabula .entry-role {
      color: #0284c7;
    }
    .entry-speaker {
      color: #64748b;
      font-size: 9pt;
    }
    .entry-body {
      padding: 14px 16px;
      font-size: 10.5pt;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 12px 0;
      font-size: 9.5pt;
      page-break-inside: avoid;
    }
    th, td {
      border: 1px solid #cbd5e1;
      padding: 6pt 10pt;
      text-align: left;
    }
    th {
      background: #f1f5f9;
      color: #334155;
      font-weight: 700;
    }
    svg {
      max-width: 100% !important;
      height: auto !important;
      display: block;
      margin: 12pt auto;
      page-break-inside: avoid;
    }
    pre {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      padding: 10px;
      border-radius: 4px;
      font-family: Consolas, monospace;
      font-size: 9pt;
      overflow-x: auto;
    }
    .report-footer {
      border-top: 1px solid #e2e8f0;
      padding-top: 12px;
      margin-top: 28px;
      font-size: 8.5pt;
      color: #94a3b8;
      display: flex;
      justify-content: space-between;
    }
    @media print {
      body { padding: 0; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="report-header">
    <div class="report-brand-row">
      <span class="report-brand">Tabula Sovereign Intelligence</span>
      <span class="report-badge">100% In-Memory Sandbox</span>
    </div>
    <h1 class="report-title">${escapeHtml(title)}</h1>
    <div class="metadata-grid">
      <div class="meta-item">
        <span class="meta-label">Source File</span>
        <span class="meta-value">${escapeHtml(session.fileName)}</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">Total Records</span>
        <span class="meta-value">${formatCount(totalRows)} rows</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">Tables</span>
        <span class="meta-value">${session.tables?.length || 1} table(s)</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">Export Date</span>
        <span class="meta-value">${dateStr}</span>
      </div>
    </div>
  </div>

  <div class="report-content">
    ${entriesHtml}
  </div>

  <div class="report-footer">
    <span>Generated by Tabula Sovereign Analytics · Confidential on-device analysis</span>
    <span>Zero Server Uploads · 100% Client-Side Privacy</span>
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() {
        window.focus();
        window.print();
      }, 350);
    };
  </script>
</body>
</html>`

  const printWindow = window.open('', '_blank')
  if (printWindow) {
    printWindow.document.write(printableHtml)
    printWindow.document.close()
  } else {
    // If popup blocked, download as HTML report file directly
    const blob = new Blob([printableHtml], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${getBaseFileName(session.fileName)}_Executive_Report.html`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }
}

/**
 * Robust Microsoft Word (.doc) Export.
 *
 * Generates an executive Word document with native tables and clean formatting.
 * Never uses canvas drawing to prevent SecurityError (tainted canvas).
 */
export function exportAnalysisAsDoc(session: Session, messages: ChatMessage[]): void {
  const baseName = getBaseFileName(session.fileName)
  const title = `${session.fileName} Analysis Report`
  const dateStr = new Date().toLocaleString()
  const totalRows = (session.tables ?? []).reduce((sum, t) => sum + (t.rowCount || 0), 0)

  const validMessages = messages.filter((m) => m.content && m.content.trim().length > 0)

  let assistantCount = 0
  const entriesHtmlList = validMessages.map((msg, idx) => {
    const isUser = msg.role === 'user'

    if (isUser) {
      return `
        <div style="margin-bottom:14pt;border:1pt solid #cbd5e1;border-left:4pt solid #0f766e;padding:12pt;background:#f8fafc;">
          <div style="font-size:10pt;font-weight:bold;color:#0f766e;margin-bottom:6pt;">
            Question #${Math.floor(idx / 2) + 1}: User Inquiry
          </div>
          <div style="font-size:11pt;color:#0f172a;font-weight:500;">
            ${escapeHtml(msg.content)}
          </div>
        </div>
      `
    } else {
      const messageBodyHtml = extractMessageContentHtml(assistantCount++, msg.content)
      return `
        <div style="margin-bottom:16pt;border:1pt solid #cbd5e1;border-left:4pt solid #0284c7;padding:12pt;background:#ffffff;">
          <div style="font-size:10pt;font-weight:bold;color:#0284c7;margin-bottom:6pt;">
            Tabula Analytical Findings #${Math.floor(idx / 2) + 1}
          </div>
          <div>
            ${messageBodyHtml}
          </div>
        </div>
      `
    }
  })

  const wordHtml = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head>
      <meta charset='utf-8'>
      <title>${escapeHtml(title)}</title>
      <style>
        body {
          font-family: 'Calibri', 'Arial', sans-serif;
          font-size: 11pt;
          color: #1e293b;
          line-height: 1.5;
        }
        h1 {
          color: #0f766e;
          font-size: 20pt;
          margin: 0 0 4pt 0;
        }
        .subtitle {
          color: #64748b;
          font-size: 10pt;
          margin-bottom: 16pt;
        }
        table.meta-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 20pt;
        }
        table.meta-table td {
          border: 1pt solid #cbd5e1;
          padding: 6pt 10pt;
          font-size: 10pt;
        }
        table.meta-table td.header {
          background-color: #f1f5f9;
          font-weight: bold;
          width: 120pt;
          color: #475569;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin: 12pt 0;
        }
        th, td {
          border: 1pt solid #cbd5e1;
          padding: 6pt 10pt;
        }
        th {
          background-color: #f1f5f9;
          font-weight: bold;
        }
      </style>
    </head>
    <body>
      <h1>${escapeHtml(title)}</h1>
      <div class="subtitle">Tabula Sovereign Briefing · Generated ${dateStr}</div>

      <table class="meta-table">
        <tr>
          <td class="header">Source Dataset</td>
          <td>${escapeHtml(session.fileName)}</td>
        </tr>
        <tr>
          <td class="header">Total Records</td>
          <td>${formatCount(totalRows)} rows</td>
        </tr>
        <tr>
          <td class="header">Tables Analyzed</td>
          <td>${session.tables?.length || 1} table(s)</td>
        </tr>
        <tr>
          <td class="header">Privacy Guarantee</td>
          <td>100% In-Memory Sandbox · Zero Server Uploads</td>
        </tr>
      </table>

      <h2>Executive Findings & Questions</h2>
      ${entriesHtmlList.join('\n')}

      <div style="margin-top:28pt;border-top:1pt solid #cbd5e1;padding-top:8pt;font-size:9pt;color:#94a3b8;">
        Exported from Tabula Sovereign Analytics · Confidential Document
      </div>
    </body>
    </html>
  `

  const blob = new Blob(['\ufeff', wordHtml], {
    type: 'application/msword;charset=utf-8',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${baseName}_Analysis.doc`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Plain Text (.txt) Export.
 */
export function exportAnalysisAsText(session: Session, messages: ChatMessage[]): void {
  const baseName = getBaseFileName(session.fileName)
  const dateStr = new Date().toLocaleString()
  const totalRows = (session.tables ?? []).reduce((sum, t) => sum + (t.rowCount || 0), 0)

  let content = `================================================================================
TABULA SOVEREIGN SPREADSHEET ANALYSIS REPORT
================================================================================
Source File:     ${session.fileName}
Total Records:   ${formatCount(totalRows)} rows
Tables Analyzed: ${session.tables?.length || 1}
Export Date:     ${dateStr}
Security:        100% In-Memory Sandbox · Zero Server Uploads
================================================================================

`

  const filtered = messages.filter((m) => m.content && m.content.trim().length > 0)

  filtered.forEach((m, idx) => {
    const isUser = m.role === 'user'
    const header = isUser
      ? `--- QUESTION #${Math.floor(idx / 2) + 1} (USER) ----------------------------------------------------`
      : `--- TABULA FINDINGS & INSIGHTS -------------------------------------------------`
    content += `${header}\n\n${cleanMarkdownForText(m.content)}\n\n`
  })

  content += `================================================================================
End of Report · Tabula Sovereign Analytics
================================================================================\n`

  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${baseName}_Analysis.txt`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
