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
export function buildReportHtml({ title, body }: ReportHtmlInput): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
<style>
  :root { color-scheme: light; }
  @page { size: A4; margin: 20mm; }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 20mm; background: #fff; color: #1e293b;
    font-family: "Times New Roman", Times, serif; font-size: 12pt; line-height: 1.5; }
  main { max-width: 760px; margin: 0 auto; }
  .report-entry { margin: 0 0 18px; }
  .markdown > :first-child { margin-top: 0; }
  .markdown > :last-child { margin-bottom: 0; }
  .markdown p, p { margin: 0 0 10px; font-size: 12pt; line-height: 1.5; text-align: justify; }
  .markdown h1 { margin: 18px 0 8px; font-size: 14pt; font-weight: 700; line-height: 1.5; color: #0f172a; text-align: left; }
  .markdown h2, .markdown h3, .markdown h4 { margin: 16px 0 6px; font-size: 12pt; font-weight: 700; line-height: 1.5; color: #0f172a; text-align: left; }
  .markdown ul, .markdown ol { padding-left: 20px; margin: 0 0 10px; font-size: 12pt; line-height: 1.5; text-align: justify; }
  .markdown code { background: #f5f6f8; padding: 1px 4px; border-radius: 4px; font-size: 0.9em; }
  .markdown pre { display: none; }
  .md-table-wrap, .data-table-block { overflow-x: auto; margin: 14px 0; }
  table { width: 100%; margin: 12px 0; border-collapse: collapse; font-size: 12pt; }
  thead { display: table-header-group; }
  tr { break-inside: avoid; page-break-inside: avoid; }
  th, td { border: 1px solid #cbd5e1; padding: 6px 10px; text-align: center; vertical-align: middle; }
  th { background: #f1f5f9; color: #0f172a; font-weight: 700; }
  tr:nth-child(even) td { background: #f8fafc; }
  .figure, .python-plots-list { margin: 14px auto; text-align: center; border: none; overflow: hidden; }
  .figure-canvas { padding: 8px 0; }
  .figure svg, .mermaid-diagram svg, .elbow-chart svg, .series-chart svg, .python-plot-image { max-width: 100%; height: auto; display: block; margin: 0 auto; }
  .figure-tools, .figure-watermark, .message-tools, .suggestions, .stream-caret, .copy-btn, .mermaid-wrapper-header { display: none !important; }
  .message-time { display: none; }
  .data-table-foot { display: none; }
  .figure { break-inside: avoid-page; }
  @media print {
    body { padding: 0; }
    main { max-width: none; }
  }
</style>
</head>
<body>
<main>
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
