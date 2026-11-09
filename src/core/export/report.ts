function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export interface ReportHtmlInput {
  title: string
  subtitle: string
  body: string
}

/** Wraps rendered report content in a standalone, print-friendly document. */
export function buildReportHtml({ title, subtitle, body }: ReportHtmlInput): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 40px 28px; background: #fff; color: #14171c;
    font-family: Inter, system-ui, -apple-system, "Segoe UI", sans-serif; font-size: 14px; line-height: 1.65; }
  main { max-width: 860px; margin: 0 auto; }
  h1 { margin: 0 0 4px; font-size: 26px; letter-spacing: -0.02em; }
  .subtitle { color: #6b7280; font-size: 12px; margin-bottom: 28px; }
  .report-entry { margin: 0 0 24px; }
  .report-entry + .report-entry { border-top: 1px solid #e5e7eb; padding-top: 20px; }
  .report-user { font-weight: 600; color: #0f766e; margin-bottom: 6px; }
  .report-assistant-label { font-weight: 600; margin-bottom: 6px; }
  .markdown > :first-child { margin-top: 0; }
  .markdown > :last-child { margin-bottom: 0; }
  .markdown p { margin: 0 0 10px; }
  .markdown h1, .markdown h2, .markdown h3, .markdown h4 { margin: 18px 0 8px; line-height: 1.3; }
  .markdown ul, .markdown ol { padding-left: 20px; margin: 0 0 10px; }
  .markdown code { background: #f5f6f8; padding: 1px 4px; border-radius: 4px; font-size: 0.9em; }
  .markdown pre { background: #f5f6f8; padding: 12px; border-radius: 8px; overflow: auto; }
  .md-table-wrap, .data-table-block { overflow-x: auto; margin: 10px 0; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th, td { border-bottom: 1px solid #e5e7eb; padding: 6px 9px; text-align: left; }
  th { background: #f6f7f9; color: #4b5563; text-transform: uppercase; font-size: 10px; }
  .figure { margin: 12px 0; border: 1px solid #e5e7eb; border-radius: 10px; overflow: hidden; }
  .figure-canvas { padding: 16px; }
  .figure svg, .mermaid-diagram svg, .elbow-chart svg, .series-chart svg { max-width: 100%; height: auto; }
  .figure-tools, .message-tools, .suggestions, .stream-caret, .copy-btn { display: none !important; }
  .message-time { display: none; }
  .data-table-foot { display: none; }
  .report-entry { break-inside: avoid-page; }
  .figure { break-inside: avoid-page; }
  @media print {
    body { padding: 0; }
    main { max-width: none; }
    .report-entry { page-break-inside: avoid; }
  }
</style>
</head>
<body>
<main>
  <h1>${escapeHtml(title)}</h1>
  <div class="subtitle">${escapeHtml(subtitle)}</div>
  ${body}
</main>
</body>
</html>`
}

export function downloadHtml(fileName: string, html: string): void {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}
