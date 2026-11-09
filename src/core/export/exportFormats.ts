import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import { parseMessageContent } from '../parsing/parseMessage'
import type { PythonExecutionResult } from '../python/types'
import type { ChartData, ChatMessage, Session } from '../types'
import { formatCount } from '../utils/format'
import { svgToPngBlob } from '../utils/image'
import { buildDocxReport } from './docxExport'
import { renderMermaidPngBatch } from './mermaidExport'

/** 2 cm on every A4 edge, in PDF points. */
const PDF_MARGIN_PT = (2 / 2.54) * 72
/** CSS pixel width of the captured report; keeps text size steady at 2 cm margins. */
const REPORT_WIDTH_PX = 570

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

/** Inline markdown → HTML. Input is escaped first so raw HTML can never leak. */
function renderInline(text: string): string {
  let html = escapeHtml(text)
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>')
  html = html.replace(
    /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
    (_match, label: string, url: string) => `<a href="${url}">${label}</a>`,
  )
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>')
  return html
}

/** A fenced code block, escaped and with no gutter or line numbers. */
function renderCodeBlock(code: string): string {
  const clean = code.replace(/\n$/, '')
  return `<pre>${escapeHtml(clean)}</pre>`
}

function isListItem(line: string): boolean {
  return /^\s*(?:[-*+]|\d+[.)])\s+/.test(line)
}

function renderList(chunk: string): string {
  const lines = chunk.split('\n').filter((line) => line.trim().length > 0)
  const ordered = /^\s*\d+[.)]\s+/.test(lines[0] ?? '')
  const items = lines
    .map((line) => `<li>${renderInline(line.replace(/^\s*(?:[-*+]|\d+[.)])\s+/, ''))}</li>`)
    .join('')
  return ordered ? `<ol>${items}</ol>` : `<ul>${items}</ul>`
}

function renderChunk(chunk: string): string {
  const lines = chunk.split('\n')

  if (lines.every((line) => !line.trim() || isListItem(line))) {
    return renderList(chunk)
  }

  const html: string[] = []
  let paragraph: string[] = []

  const flushParagraph = () => {
    if (paragraph.length === 0) return
    html.push(`<p>${paragraph.map(renderInline).join('<br/>')}</p>`)
    paragraph = []
  }

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]
    const heading = /^(#{1,6})\s+(.*)$/.exec(line.trim())
    if (heading) {
      flushParagraph()
      const level = Math.min(heading[1].length, 4)
      html.push(`<h${level}>${renderInline(heading[2])}</h${level}>`)
      continue
    }

    const quote = /^\s*>\s?(.*)$/.exec(line)
    if (quote) {
      flushParagraph()
      html.push(`<blockquote>${renderInline(quote[1])}</blockquote>`)
      continue
    }

    if (isListItem(line)) {
      flushParagraph()
      const items: string[] = []
      while (index < lines.length && isListItem(lines[index])) {
        items.push(
          `<li>${renderInline(lines[index].replace(/^\s*(?:[-*+]|\d+[.)])\s+/, ''))}</li>`,
        )
        index += 1
      }
      index -= 1
      const ordered = /^\s*\d+[.)]\s+/.test(line)
      html.push(ordered ? `<ol>${items.join('')}</ol>` : `<ul>${items.join('')}</ul>`)
      continue
    }

    paragraph.push(line)
  }

  flushParagraph()
  return html.join('\n')
}

/**
 * Converts one markdown block to clean HTML. Fenced code is protected before
 * inline/heading/list transforms, which is what kept code from being mangled
 * into headings, bullets or bold text in the old regex pass.
 */
function renderMarkdownBlock(markdown: string): string {
  if (!markdown.trim()) return ''

  const codeBlocks: string[] = []
  const withPlaceholders = markdown.replace(
    /```([\w+-]*)[ \t]*\r?\n([\s\S]*?)```/g,
    (_match, _lang, code: string) => {
      const index = codeBlocks.length
      codeBlocks.push(renderCodeBlock(code))
      return `\n\n@@TABULA_CODE_${index}@@\n\n`
    },
  )

  return withPlaceholders
    .split(/\n{2,}/)
    .map((chunk) => {
      const trimmed = chunk.trim()
      if (!trimmed) return ''
      const placeholder = /^@@TABULA_CODE_(\d+)@@$/.exec(trimmed)
      if (placeholder) return codeBlocks[Number(placeholder[1])] ?? ''
      return renderChunk(trimmed)
    })
    .join('\n')
}

function isNumericCell(value: string): boolean {
  const trimmed = value.trim().replace(/[,%$€£₨]/g, '')
  return /^-?\d+(\.\d+)?$/.test(trimmed)
}

/** Compact table: small type, fixed layout, never spills off the page. */
function renderTable(headers: string[], rows: string[][]): string {
  if (headers.length === 0) return ''

  const head = headers.map((header) => `<th>${renderInline(header)}</th>`).join('')
  const body = rows
    .map(
      (row) =>
        `<tr>${headers
          .map((_header, index) => {
            const value = row[index] ?? ''
            const numeric = isNumericCell(value)
            return `<td${numeric ? ' class="tabula-num"' : ''}>${renderInline(value)}</td>`
          })
          .join('')}</tr>`,
    )
    .join('')

  return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`
}

function renderFigure(dataUrl: string): string {
  return `<div class="tabula-figure"><img src="${dataUrl}" alt="Chart" /></div>`
}

/** Chart data as a compact table when its live SVG is unavailable. */
function chartToTable(chart: ChartData): string {
  const title = `<h3>${renderInline(chart.title)}</h3>`
  const note = chart.note ? `<p>${renderInline(chart.note)}</p>` : ''

  if (chart.type === 'elbow') {
    const rows = chart.points.map((point) => [String(point.x), String(point.y)])
    return `${title}${note}${renderTable([chart.xLabel, chart.yLabel], rows)}`
  }

  const rows = chart.points.map((point) => [point.label, String(point.value)])
  return `${title}${note}${renderTable([chart.xLabel, chart.yLabel], rows)}`
}

function assistantMessageElements(): HTMLElement[] {
  return Array.from(
    document.querySelectorAll<HTMLElement>('.chat-column .message.message-assistant'),
  )
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      resolve(typeof reader.result === 'string' ? reader.result : '')
    }
    reader.onerror = () => resolve('')
    reader.readAsDataURL(blob)
  })
}

async function chartSvgToDataUrl(svg: SVGSVGElement | null | undefined): Promise<string> {
  if (!(svg instanceof SVGSVGElement)) return ''
  try {
    return await blobToDataUrl(await svgToPngBlob(svg, 1.6))
  } catch (err) {
    console.warn('Could not rasterize chart for export:', err)
    return ''
  }
}

interface ReportDocument {
  title: string
  html: string
  css: string
  baseName: string
}

const REPORT_CSS = `
@page { size: A4; margin: 20mm; }
.tabula-report {
  color: #14213d;
  font-family: 'Times New Roman', Times, 'Liberation Serif', Georgia, serif;
  font-size: 12px;
  line-height: 1.48;
  text-align: left;
  background: #ffffff;
}
.tabula-report * { box-sizing: border-box; }
.tabula-report h1,
.tabula-report h2,
.tabula-report h3,
.tabula-report h4 {
  font-family: 'Times New Roman', Times, 'Liberation Serif', Georgia, serif;
  font-size: 12px;
  font-weight: 700;
  line-height: 1.35;
  text-align: left;
  color: #0f4c5c;
  margin: 10px 0 5px;
}
.tabula-report p {
  margin: 0 0 7px;
  font-size: 12px;
  line-height: 1.5;
  text-align: left;
  color: #1e293b;
}
.tabula-report ul,
.tabula-report ol {
  margin: 4px 0 8px;
  padding-left: 18px;
  text-align: left;
  list-style-position: outside;
}
.tabula-report li {
  margin: 0 0 2px;
  font-size: 12px;
  line-height: 1.45;
}
.tabula-report blockquote {
  margin: 6px 0;
  padding: 5px 10px;
  border-left: 2px solid #cbd5e1;
  color: #475569;
  font-size: 12px;
  text-align: left;
}
.tabula-report a { color: #0f766e; text-decoration: underline; }
.tabula-report code {
  padding: 1px 3px;
  border-radius: 2px;
  background: #f1f5f9;
  color: #0f172a;
  font-family: Consolas, Menlo, Monaco, monospace;
  font-size: 10px;
}
.tabula-report pre {
  margin: 6px 0;
  padding: 7px 9px;
  border: 1px solid #d7e1ec;
  border-radius: 6px;
  background: #f7fafc;
  color: #0f172a;
  font-family: Consolas, Menlo, Monaco, monospace;
  font-size: 9.5px;
  line-height: 1.4;
  white-space: pre-wrap;
  word-break: break-word;
  overflow-wrap: anywhere;
}
.tabula-report table {
  width: 86%;
  max-width: 520px;
  margin: 7px auto 10px;
  border-collapse: collapse;
  table-layout: fixed;
  font-size: 9.5px;
}
.tabula-report th,
.tabula-report td {
  padding: 3px 5px;
  border: 1px solid #cbd5e1;
  text-align: center;
  vertical-align: middle;
  word-break: break-word;
  overflow-wrap: anywhere;
}
.tabula-report th {
  background: #f1f5f9;
  color: #0f172a;
  font-size: 9.5px;
  font-weight: 700;
}
.tabula-report td { color: #334155; }
.tabula-report td.tabula-num {
  text-align: center;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}
.tabula-report .tabula-figure {
  width: 86%;
  margin: 9px auto;
  padding: 8px;
  text-align: center;
  page-break-inside: avoid;
  break-inside: avoid;
}
.tabula-report .tabula-figure img {
  display: block;
  max-width: 100%;
  max-height: 280px;
  width: auto;
  height: auto;
  margin: 0 auto;
  background: #ffffff;
}
.tabula-report .tabula-header {
  margin: 0 0 14px;
  padding-bottom: 9px;
  border-bottom: 2px solid #0f4c5c;
}
.tabula-report .tabula-brand-row {
  display: block;
  margin: 0 0 2px;
  text-align: left;
}
.tabula-report .tabula-brand {
  color: #0f4c5c;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.tabula-report .tabula-title { margin: 0 0 8px; text-align: left; color: #0f172a; }
.tabula-report .tabula-meta { width: 100%; margin: 0; }
.tabula-report .tabula-meta td { padding: 4px 5px; }
.tabula-report .tabula-meta-label {
  color: #64748b;
  font-size: 8px;
  font-weight: 700;
  text-transform: uppercase;
}
.tabula-report .tabula-meta-value { color: #0f172a; font-size: 11px; font-weight: 600; }
.tabula-report .tabula-entry {
  margin: 0 0 12px;
  border: 1px solid #d7e1ec;
  border-radius: 7px;
  background: #ffffff;
  page-break-inside: auto;
}
.tabula-report .tabula-entry-user { background: #ffffff; }
.tabula-report .tabula-entry-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  padding: 6px 8px;
  border-bottom: 1px solid #e2e8f0;
  background: #f3f7fb;
  text-align: left;
}
.tabula-report .tabula-entry-title { font-size: 12px; font-weight: 700; color: #0f4c5c; }
.tabula-report .tabula-entry-user .tabula-entry-title { color: #0f4c5c; }
.tabula-report .tabula-entry-meta { color: #64748b; font-size: 9px; }
.tabula-report .tabula-entry-body { padding: 8px 12px 7px; }
.tabula-report .tabula-entry-body > :last-child { margin-bottom: 0; }
.tabula-report .tabula-footer {
  margin: 16px 0 0;
  padding-top: 6px;
  border-top: 1px solid #e2e8f0;
  display: flex;
  justify-content: space-between;
  gap: 8px;
  color: #94a3b8;
  font-size: 8px;
  text-align: left;
}
`.trim()

interface BuildContext {
  mermaidCodes: string[]
}

function addMermaid(context: BuildContext, code: string): string {
  const index = context.mermaidCodes.length
  context.mermaidCodes.push(code)
  return `%%TABULA_MERMAID_${index}%%`
}

/** Renders one assistant message from its parsed blocks, not from the live DOM. */
async function renderAssistantMessage(
  content: string,
  dom: HTMLElement | undefined,
  context: BuildContext,
): Promise<string> {
  const blocks = parseMessageContent(content)
  const parts: string[] = []
  const chartSvgs = dom?.querySelectorAll<SVGSVGElement>('.elbow-chart svg, .series-chart svg')
  let chartIndex = 0

  for (const block of blocks) {
    if (block.type === 'mermaid') {
      parts.push(addMermaid(context, block.code))
      continue
    }

    if (block.type === 'chart') {
      const dataUrl = await chartSvgToDataUrl(chartSvgs?.[chartIndex])
      chartIndex += 1
      parts.push(dataUrl ? renderFigure(dataUrl) : chartToTable(block.chart))
      continue
    }

    if (block.type === 'table') {
      parts.push(renderTable(block.headers, block.rows))
      continue
    }

    parts.push(renderMarkdownBlock(block.content))
  }

  return parts.filter((part) => part.trim().length > 0).join('\n')
}

function renderUserMessage(content: string): string {
  return `<p>${escapeHtml(content).replace(/\n/g, '<br/>')}</p>`
}

function renderPythonSection(result: PythonExecutionResult): string {
  const parts: string[] = []

  if (result.code) {
    parts.push('<h3>Analysis Logic</h3>')
    parts.push(renderCodeBlock(result.code))
  }

  if (result.images && result.images.length > 0) {
    parts.push('<h3>Generated Visualizations</h3>')
    result.images.forEach((image) => {
      parts.push(renderFigure(`data:image/png;base64,${image}`))
    })
  }

  if (result.stdout) {
    parts.push('<h3>Console Output</h3>')
    parts.push(renderCodeBlock(result.stdout))
  }

  if (result.error) {
    parts.push('<h3>Execution Error</h3>')
    parts.push(renderCodeBlock(result.error))
  }

  return parts.join('\n')
}

/**
 * Builds one executive report document used by both PDF and Word export.
 * Diagrams are rendered directly from their source, so they are always present
 * and always use dark ink on white regardless of the on-screen theme.
 */
async function buildExecutiveReportHtml(
  session: Session,
  messages: ChatMessage[],
  pythonResult?: PythonExecutionResult | null,
  onProgress?: (status: string) => void,
): Promise<ReportDocument> {
  const baseName = getBaseFileName(session.fileName)
  const title = `${session.fileName} — Executive Analysis Report`
  const dateStr = new Date().toLocaleString()
  const totalRows = (session.tables ?? []).reduce((sum, table) => sum + (table.rowCount || 0), 0)

  const validMessages = messages.filter((message) => message.content && message.content.trim())
  const domMessages = assistantMessageElements()
  const context: BuildContext = { mermaidCodes: [] }

  let assistantIndex = 0
  const entries: string[] = []

  for (let index = 0; index < validMessages.length; index++) {
    const message = validMessages[index]
    const inquiry = Math.floor(index / 2) + 1

    if (message.role === 'user') {
      entries.push(`
        <section class="tabula-entry tabula-entry-user">
          <div class="tabula-entry-head">
            <strong class="tabula-entry-title">Inquiry #${inquiry}</strong>
            <span class="tabula-entry-meta">User Prompt</span>
          </div>
          <div class="tabula-entry-body">${renderUserMessage(message.content)}</div>
        </section>
      `)
      continue
    }

    const body = await renderAssistantMessage(
      message.content,
      domMessages[assistantIndex],
      context,
    )
    assistantIndex += 1

    entries.push(`
      <section class="tabula-entry">
        <div class="tabula-entry-head">
          <strong class="tabula-entry-title">Tabula Analytical Findings #${inquiry}</strong>
          <span class="tabula-entry-meta">Tabula Intelligence</span>
        </div>
        <div class="tabula-entry-body">${body}</div>
      </section>
    `)
  }

  if (pythonResult && (pythonResult.images?.length || pythonResult.stdout || pythonResult.code)) {
    entries.push(`
      <section class="tabula-entry">
        <div class="tabula-entry-head">
          <strong class="tabula-entry-title">Analytical Visualizations</strong>
          <span class="tabula-entry-meta">Executive Analytics</span>
        </div>
        <div class="tabula-entry-body">${renderPythonSection(pythonResult)}</div>
      </section>
    `)
  }

  let html = `
    <div class="tabula-report">
      <header class="tabula-header">
        <div class="tabula-brand-row">
          <span class="tabula-brand">Tabula Sovereign Intelligence</span>
        </div>
        <h1 class="tabula-title">${escapeHtml(title)}</h1>
        <table class="tabula-meta">
          <tbody>
            <tr>
              <td>
                <div class="tabula-meta-label">Source File</div>
                <div class="tabula-meta-value">${escapeHtml(session.fileName)}</div>
              </td>
              <td>
                <div class="tabula-meta-label">Total Records</div>
                <div class="tabula-meta-value">${formatCount(totalRows)} rows</div>
              </td>
              <td>
                <div class="tabula-meta-label">Tables</div>
                <div class="tabula-meta-value">${session.tables?.length || 1} table(s)</div>
              </td>
              <td>
                <div class="tabula-meta-label">Export Date</div>
                <div class="tabula-meta-value">${dateStr}</div>
              </td>
            </tr>
          </tbody>
        </table>
      </header>
      ${entries.join('\n')}
    </div>
  `

  if (context.mermaidCodes.length > 0) {
    onProgress?.(
      `Rendering ${context.mermaidCodes.length} diagram${context.mermaidCodes.length === 1 ? '' : 's'}…`,
    )
    const images = await renderMermaidPngBatch(context.mermaidCodes, (done, total) => {
      if (done < total) onProgress?.(`Rendering diagrams… ${done}/${total}`)
    })

    html = html.replace(/%%TABULA_MERMAID_(\d+)%%/g, (_match, rawIndex) => {
      const index = Number(rawIndex)
      const dataUrl = images[index]
      if (dataUrl) return renderFigure(dataUrl)
      return renderCodeBlock(context.mermaidCodes[index] ?? '')
    })
  }

  return { title, html, css: REPORT_CSS, baseName }
}

function pngDataUrlSize(dataUrl: string): { width: number; height: number } | null {
  try {
    const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1)
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index)
    const view = new DataView(bytes.buffer)
    return { width: view.getUint32(16), height: view.getUint32(20) }
  } catch {
    return null
  }
}

function collectImageDataUrls(html: string): string[] {
  return Array.from(html.matchAll(/src="(data:image\/[^"]+)"/g)).map((match) => match[1])
}

function isCanvasBlank(canvas: HTMLCanvasElement): boolean {
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context || canvas.width === 0 || canvas.height === 0) return true

  const { data } = context.getImageData(0, 0, canvas.width, canvas.height)
  const stepX = Math.max(1, Math.floor(canvas.width / 160))
  const stepY = Math.max(1, Math.floor(canvas.height / 220))

  for (let y = 0; y < canvas.height; y += stepY) {
    for (let x = 0; x < canvas.width; x += stepX) {
      const index = (y * canvas.width + x) * 4
      const alpha = data[index + 3]
      if (alpha > 8 && (data[index] < 245 || data[index + 1] < 245 || data[index + 2] < 245)) {
        return false
      }
    }
  }
  return true
}

function isCanvasRowBlank(
  context: CanvasRenderingContext2D,
  width: number,
  y: number,
): boolean {
  const row = context.getImageData(0, y, width, 1).data
  for (let x = 0; x < width; x += 3) {
    const index = x * 4
    if (row[index + 3] > 8 && (row[index] < 245 || row[index + 1] < 245 || row[index + 2] < 245)) {
      return false
    }
  }
  return true
}

/** Moves a page cut upward to the nearest blank row so text is never split. */
function findBreakRow(
  context: CanvasRenderingContext2D,
  ideal: number,
  minimum: number,
  width: number,
): number {
  const lowerBound = Math.max(1, minimum)
  for (let y = ideal; y >= lowerBound; y--) {
    if (isCanvasRowBlank(context, width, y)) return y
  }
  return ideal
}

/** Slices one tall canvas across A4 pages and returns the page count. */
interface AvoidRange {
  top: number
  bottom: number
}

function addCanvasToPdf(
  pdf: jsPDF,
  canvas: HTMLCanvasElement,
  pageWidth: number,
  pageHeight: number,
  margin: number,
  avoidRanges: AvoidRange[] = [],
): number {
  const context = canvas.getContext('2d', { willReadFrequently: true })
  const contentWidth = pageWidth - margin * 2
  const contentHeight = pageHeight - margin * 2
  const scale = contentWidth / canvas.width
  const pageHeightPx = Math.max(1, Math.floor(contentHeight / scale))

  let offset = 0
  let pageIndex = 0

  while (offset < canvas.height) {
    let ideal = Math.min(canvas.height, offset + pageHeightPx)

    const blocked = avoidRanges.find(
      (range) =>
        ideal > range.top && ideal < range.bottom + 10 && range.top > offset + 40,
    )
    if (blocked) ideal = Math.floor(blocked.top)

    if (ideal < canvas.height && context) {
      ideal = findBreakRow(
        context,
        ideal,
        offset + Math.floor(pageHeightPx * 0.55),
        canvas.width,
      )
    }
    const sliceHeight = Math.max(1, ideal - offset)

    const slice = document.createElement('canvas')
    slice.width = canvas.width
    slice.height = sliceHeight
    const sliceContext = slice.getContext('2d')
    if (!sliceContext) throw new Error('Could not allocate PDF page canvas')

    sliceContext.fillStyle = '#ffffff'
    sliceContext.fillRect(0, 0, slice.width, slice.height)
    sliceContext.drawImage(
      canvas,
      0,
      offset,
      canvas.width,
      sliceHeight,
      0,
      0,
      canvas.width,
      sliceHeight,
    )

    if (pageIndex > 0) pdf.addPage()
    pdf.addImage(
      slice.toDataURL('image/png'),
      'PNG',
      margin,
      margin,
      contentWidth,
      sliceHeight * scale,
      undefined,
      'FAST',
    )

    pageIndex += 1
    offset = ideal
  }

  return pageIndex
}

/**
 * Direct native PDF renderer used only if HTML-to-canvas compilation fails or
 * yields a blank page. Draws text and any embedded diagrams with jsPDF's vector
 * engine so the downloaded file always has visible content.
 */
function generateDirectNativePdf(
  session: Session,
  messages: ChatMessage[],
  pythonResult: PythonExecutionResult | null | undefined,
  fileName: string,
  extraImages: string[] = [],
): void {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const margin = 40
  const contentWidth = pageWidth - margin * 2
  let y = margin

  const checkPageBreak = (neededHeight: number) => {
    if (y + neededHeight > pageHeight - margin) {
      pdf.addPage()
      y = margin
    }
  }

  pdf.setFont('times', 'bold')
  pdf.setFontSize(10)
  pdf.setTextColor(15, 118, 110)
  pdf.text('TABULA SOVEREIGN INTELLIGENCE', margin, y)
  y += 14

  pdf.setFontSize(12)
  pdf.setTextColor(15, 23, 42)
  pdf.text(session.fileName, margin, y)
  y += 14

  pdf.setFont('times', 'normal')
  pdf.setFontSize(10)
  pdf.setTextColor(100, 116, 139)
  const totalRows = (session.tables ?? []).reduce((sum, table) => sum + (table.rowCount || 0), 0)
  pdf.text(
    `Records: ${formatCount(totalRows)} · Exported: ${new Date().toLocaleString()} · 100% In-Memory Sandbox`,
    margin,
    y,
  )
  y += 10

  pdf.setDrawColor(15, 118, 110)
  pdf.setLineWidth(1.5)
  pdf.line(margin, y, margin + contentWidth, y)
  y += 16

  const validMessages = messages.filter((message) => message.content && message.content.trim())

  validMessages.forEach((message, index) => {
    const isUser = message.role === 'user'
    checkPageBreak(40)

    pdf.setFont('times', 'bold')
    pdf.setFontSize(12)
    pdf.setTextColor(isUser ? 15 : 2, isUser ? 118 : 132, isUser ? 110 : 199)
    pdf.text(
      `${isUser ? 'Inquiry' : 'Analytical Findings'} #${Math.floor(index / 2) + 1}`,
      margin,
      y,
    )
    y += 14

    pdf.setFont('times', 'normal')
    pdf.setFontSize(12)
    pdf.setTextColor(isUser ? 15 : 30, isUser ? 23 : 41, isUser ? 42 : 59)
    const text = isUser ? message.content : cleanMarkdownForText(message.content)
    const lines = pdf.splitTextToSize(text, contentWidth)
    checkPageBreak(lines.length * 13 + 8)
    pdf.text(lines, margin, y)
    y += lines.length * 13 + 14
  })

  if (pythonResult?.images && pythonResult.images.length > 0) {
    pythonResult.images.forEach((imageBase64, imageIndex) => {
      checkPageBreak(190)
      pdf.setFont('times', 'bold')
      pdf.setFontSize(12)
      pdf.setTextColor(124, 58, 237)
      pdf.text(`Visualization #${imageIndex + 1}`, margin, y)
      y += 12
      try {
        pdf.addImage(
          `data:image/png;base64,${imageBase64}`,
          'PNG',
          margin,
          y,
          Math.min(contentWidth, 380),
          170,
        )
        y += 180
      } catch {
        // Continue when an embedded image format is invalid.
      }
    })
  }

  extraImages.forEach((dataUrl, imageIndex) => {
    const size = pngDataUrlSize(dataUrl)
    let width = Math.min(contentWidth, 460)
    let height = size ? (width * size.height) / size.width : 220
    if (height > 360) {
      height = 360
      width = size ? (height * size.width) / size.height : contentWidth
    }

    checkPageBreak(height + 26)
    pdf.setFont('times', 'bold')
    pdf.setFontSize(12)
    pdf.setTextColor(15, 118, 110)
    pdf.text(`Diagram #${imageIndex + 1}`, margin, y)
    y += 12

    try {
      pdf.addImage(dataUrl, 'PNG', margin + (contentWidth - width) / 2, y, width, height)
      y += height + 16
    } catch {
      // Continue when an embedded diagram format is invalid.
    }
  })

  pdf.save(fileName)
}

/**
 * Direct PDF download. Renders the report with html2canvas, verifies the canvas
 * actually contains ink, then slices it across A4 pages. A blank or failed
 * capture falls back to the native renderer so the file is never empty.
 */
export async function exportAnalysisAsPdf(
  session: Session,
  messages: ChatMessage[],
  pythonResult?: PythonExecutionResult | null,
  onProgress?: (status: string) => void,
): Promise<void> {
  onProgress?.('Preparing executive report data…')
  const { html, css, baseName } = await buildExecutiveReportHtml(
    session,
    messages,
    pythonResult,
    onProgress,
  )
  const embeddedImages = collectImageDataUrls(html)

  onProgress?.('Formatting document & assets…')
  const container = document.createElement('div')
  container.className = 'tabula-pdf-render-canvas'
  container.style.cssText = `
    position: fixed;
    left: 0;
    top: 0;
    width: ${REPORT_WIDTH_PX}px;
    height: auto;
    background: #ffffff;
    color: #1e293b;
    padding: 0;
    box-sizing: border-box;
    z-index: -99999;
    pointer-events: none;
    opacity: 1;
  `
  container.innerHTML = `<style>${css}</style>${html}`
  document.body.appendChild(container)

  try {
    await document.fonts.ready

    const images = Array.from(container.querySelectorAll('img'))
    if (images.length > 0) {
      onProgress?.(`Rasterizing ${images.length} visual asset${images.length > 1 ? 's' : ''}…`)
      await Promise.all(
        images.map(
          (image) =>
            new Promise((resolve) => {
              if (image.complete && image.naturalHeight > 0) {
                resolve(true)
              } else {
                image.onload = () => resolve(true)
                image.onerror = () => resolve(false)
                setTimeout(() => resolve(false), 4000)
              }
            }),
        ),
      )
    }

    const containerRect = container.getBoundingClientRect()
    const figureRects = Array.from(
      container.querySelectorAll<HTMLElement>('.tabula-figure'),
    ).map((figure) => {
      const rect = figure.getBoundingClientRect()
      return { top: rect.top - containerRect.top, bottom: rect.bottom - containerRect.top }
    })

    onProgress?.('Rendering report pages…')
    const canvas = await html2canvas(container, {
      scale: 1.5,
      useCORS: true,
      allowTaint: true,
      logging: false,
      backgroundColor: '#ffffff',
      scrollX: 0,
      scrollY: 0,
      windowWidth: REPORT_WIDTH_PX,
      width: REPORT_WIDTH_PX,
      height: Math.max(container.scrollHeight, container.offsetHeight, 1),
    })

    if (isCanvasBlank(canvas)) {
      throw new Error('Rendered report canvas is blank')
    }

    onProgress?.('Compiling pages into PDF…')
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    const canvasScale = canvas.width / (containerRect.width || 650)
    const avoidRanges = figureRects.map((range) => ({
      top: range.top * canvasScale,
      bottom: range.bottom * canvasScale,
    }))
    const pages = addCanvasToPdf(pdf, canvas, pageWidth, pageHeight, PDF_MARGIN_PT, avoidRanges)

    if (pages === 0) throw new Error('Rendered report produced no pages')

    for (let pageIndex = 1; pageIndex <= pages; pageIndex++) {
      pdf.setPage(pageIndex)
      pdf.setFont('times', 'normal')
      pdf.setFontSize(7)
      pdf.setTextColor(148, 163, 184)
      const footerY = pageHeight - PDF_MARGIN_PT / 2
      pdf.text(
        'Generated by Tabula Sovereign Analytics · Confidential on-device analysis',
        PDF_MARGIN_PT,
        footerY,
      )
      pdf.text('Zero Server Uploads · 100% Client-Side Privacy', pageWidth - PDF_MARGIN_PT, footerY, {
        align: 'right',
      })
    }

    onProgress?.('Saving PDF file…')
    pdf.save(`${baseName}_Executive_Report.pdf`)
  } catch (err) {
    console.warn('HTML-to-canvas PDF compilation failed, using native renderer:', err)
    onProgress?.('Generating direct PDF document…')
    generateDirectNativePdf(
      session,
      messages,
      pythonResult,
      `${baseName}_Executive_Report.pdf`,
      embeddedImages,
    )
  } finally {
    container.remove()
  }
}

/**
 * Word document export.
 *
 * Produces a real Office Open XML `.docx` (not HTML renamed to `.doc`) with
 * native paragraphs, tables and embedded PNG diagrams, so Word always shows
 * the report content.
 */
export async function exportAnalysisAsDoc(
  session: Session,
  messages: ChatMessage[],
  pythonResult?: PythonExecutionResult | null,
  onProgress?: (status: string) => void,
): Promise<void> {
  onProgress?.('Formatting Word document & visual assets…')
  const { blob, fileName } = await buildDocxReport(session, messages, pythonResult, onProgress)

  onProgress?.('Saving Word file (.docx)…')
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

function cleanMarkdownForText(markdown: string): string {
  return markdown
    .replace(/```[a-z]*\r?\n([\s\S]*?)```/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/^#+\s+/gm, '')
    .replace(/<[^>]*>/g, '')
    .trim()
}

/** Plain Text (.txt) Export. */
export function exportAnalysisAsText(
  session: Session,
  messages: ChatMessage[],
  pythonResult?: PythonExecutionResult | null,
  onProgress?: (status: string) => void,
): void {
  onProgress?.('Compiling plain-text summary…')
  const baseName = getBaseFileName(session.fileName)
  const dateStr = new Date().toLocaleString()
  const totalRows = (session.tables ?? []).reduce((sum, table) => sum + (table.rowCount || 0), 0)

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

  const filtered = messages.filter((message) => message.content && message.content.trim())

  filtered.forEach((message, index) => {
    const isUser = message.role === 'user'
    const header = isUser
      ? `--- QUESTION #${Math.floor(index / 2) + 1} (USER) ----------------------------------------------------`
      : '--- TABULA FINDINGS & INSIGHTS -------------------------------------------------'
    content += `${header}\n\n${cleanMarkdownForText(message.content)}\n\n`
  })

  if (pythonResult) {
    if (pythonResult.code) {
      content += `--- PYTHON EXECUTION CODE -----------------------------------------------------\n${pythonResult.code}\n\n`
    }
    if (pythonResult.stdout) {
      content += `--- CONSOLE OUTPUT ------------------------------------------------------------\n${pythonResult.stdout}\n\n`
    }
  }

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
