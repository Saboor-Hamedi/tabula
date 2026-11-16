import { jsPDF } from 'jspdf'
import { stripLeadingPreamble } from '../agent/runAgentTurn'
import { parseMessageContent } from '../parsing/parseMessage'
import type { PythonExecutionResult } from '../python/types'
import type { ChartData, ChatMessage, Session } from '../types'
import { svgToPngBlob } from '../utils/image'
import { buildDocxReport } from './docxExport'
import { renderMermaidPngBatch } from './mermaidExport'

/** 2 cm print margin on all 4 sides (top, right, bottom, left) in PDF points. */
const PAGE_MARGIN_PT = Math.round((2 / 2.54) * 72 * 10) / 10 // ~56.7 pt

export function cleanReportTitle(raw: string): string {
  return (raw || '')
    .replace(/\.(csv|xlsx|xls|tsv|parquet)\b/gi, '')
    .replace(/([_-]merged)+/gi, ' ')
    .replace(/[_-]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function getBaseFileName(fileName: string): string {
  const cleaned = cleanReportTitle(fileName).replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '')
  return cleaned || 'Report'
}

function normalizeImageDataUrl(img: string): string {
  const trimmed = (img || '').trim()
  if (!trimmed) return ''
  return trimmed.startsWith('data:image/') ? trimmed : `data:image/png;base64,${trimmed}`
}

function stripInlineFormatting(text: string): string {
  return (text || '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*\n]+)\*/g, '$1')
    .replace(/~~([^~]+)~~/g, '$1')
    .trim()
}

function cleanHeadingText(text: string): string {
  return cleanReportTitle(stripInlineFormatting(text))
}

function assistantMessageElements(): HTMLElement[] {
  return Array.from(
    globalThis.document.querySelectorAll<HTMLElement>('.chat-column .message.message-assistant'),
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
    return await blobToDataUrl(await svgToPngBlob(svg, 2))
  } catch (err) {
    console.warn('Could not rasterize chart for export:', err)
    return ''
  }
}

function pngDataUrlSize(dataUrl: string): { width: number; height: number } | null {
  try {
    const clean = normalizeImageDataUrl(dataUrl)
    const base64 = clean.slice(clean.lastIndexOf(',') + 1)
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index)
    const view = new DataView(bytes.buffer)
    return { width: view.getUint32(16), height: view.getUint32(20) }
  } catch {
    return null
  }
}

interface PreparedPdfEntry {
  message: ChatMessage
  blocks: ReturnType<typeof parseMessageContent>
}

/**
 * Print-ready vector PDF export.
 *
 * - 2 cm margins on top, right, bottom, and left
 * - No headers, no footers, no watermarks, no panel containers
 * - 1.5x line spacing and true left-to-right justified paragraphs
 * - Normal centered grid tables with centered cell text
 * - High-resolution centered figures
 */
export async function exportAnalysisAsPdf(
  session: Session,
  messages: ChatMessage[],
  pythonResult?: PythonExecutionResult | null,
  onProgress?: (status: string) => void,
): Promise<void> {
  onProgress?.('Preparing report…')
  const baseName = getBaseFileName(session.fileName)
  const validMessages = messages.filter((message) => message.content && message.content.trim())

  const prepared: PreparedPdfEntry[] = validMessages.map((message) => ({
    message,
    blocks:
      message.role === 'assistant'
        ? parseMessageContent(stripLeadingPreamble(message.content))
        : [],
  }))

  const mermaidCodes = prepared.flatMap((entry) =>
    entry.blocks.filter((block) => block.type === 'mermaid').map((block) => block.code),
  )

  let mermaidImages: string[] = []
  if (mermaidCodes.length > 0) {
    onProgress?.(
      `Rendering ${mermaidCodes.length} diagram${mermaidCodes.length === 1 ? '' : 's'}…`,
    )
    mermaidImages = await renderMermaidPngBatch(mermaidCodes, (done, total) => {
      if (done < total) onProgress?.(`Rendering diagrams… ${done}/${total}`)
    })
  }

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const margin = PAGE_MARGIN_PT
  const contentWidth = pageWidth - margin * 2
  const bottomLimit = pageHeight - margin
  let y = margin + 12

  const ensureSpace = (neededHeight: number) => {
    if (y + neededHeight > bottomLimit) {
      pdf.addPage()
      y = margin + 12
    }
  }

  /**
   * Draws a single line of text either flush-left (last line of a paragraph)
   * or full-width justified between `xLeft` and `xLeft + maxWidth`.
   */
  const drawJustifiedLine = (
    line: string,
    xLeft: number,
    maxWidth: number,
    isLastLine: boolean,
  ) => {
    const trimmed = line.trim()
    if (!trimmed) return
    if (isLastLine) {
      pdf.text(trimmed, xLeft, y)
      return
    }
    const words = trimmed.split(/\s+/)
    if (words.length <= 1) {
      pdf.text(trimmed, xLeft, y)
      return
    }
    const wordsWidth = words.reduce((sum, w) => sum + pdf.getTextWidth(w), 0)
    if (wordsWidth < maxWidth * 0.62) {
      pdf.text(trimmed, xLeft, y)
      return
    }
    const gap = (maxWidth - wordsWidth) / (words.length - 1)
    let curX = xLeft
    for (const word of words) {
      pdf.text(word, curX, y)
      curX += pdf.getTextWidth(word) + gap
    }
  }

  const drawFigure = (rawDataUrl: string) => {
    const dataUrl = normalizeImageDataUrl(rawDataUrl)
    if (!dataUrl) return
    const size = pngDataUrlSize(dataUrl)
    const maxW = contentWidth
    const maxH = 280
    let width = maxW
    let height = size && size.width > 0 ? (width * size.height) / size.width : 200
    if (height > maxH) {
      height = maxH
      width = size && size.height > 0 ? (height * size.width) / size.height : maxW
    }

    ensureSpace(height + 18)
    try {
      const x = margin + (contentWidth - width) / 2
      pdf.addImage(dataUrl, 'PNG', x, y, width, height, undefined, 'FAST')
      y += height + 18
    } catch {
      // Ignore malformed image data URL
    }
  }

  const drawTable = (headers: string[], rows: string[][]) => {
    if (headers.length === 0) return
    const colCount = headers.length
    const cleanHeaders = headers.map((h) => cleanReportTitle(stripInlineFormatting(h)))
    const cleanRows = rows.map((row) =>
      headers.map((_h, idx) => stripInlineFormatting(row[idx] ?? '')),
    )

    // Table width matches paragraph width (contentWidth)
    const tableWidth = contentWidth
    const tableX = margin

    const weights = cleanHeaders.map((header, colIdx) => {
      let maxLen = Math.max(header.length, 6)
      for (let r = 0; r < Math.min(cleanRows.length, 40); r++) {
        const cellLen = (cleanRows[r]?.[colIdx] ?? '').length
        if (cellLen > maxLen) maxLen = cellLen
      }
      return Math.min(Math.max(maxLen, 6), 34)
    })
    const totalWeight = weights.reduce((a, b) => a + b, 0) || 1
    const colWidths = weights.map((w) => (w / totalWeight) * tableWidth)

    const cellPadX = 5
    const tableFontSize = 12
    const lineHeight = 15

    pdf.setFont('times', 'bold')
    pdf.setFontSize(tableFontSize)
    const headerCellLines = cleanHeaders.map((h, i) =>
      pdf.splitTextToSize(h, Math.max(18, colWidths[i] - cellPadX * 2)) as string[],
    )
    const maxHeaderLines = Math.max(1, ...headerCellLines.map((l) => l.length))
    const headerHeight = maxHeaderLines * lineHeight + 10

    const computeRowLines = (row: string[]) => {
      pdf.setFont('times', 'normal')
      pdf.setFontSize(tableFontSize)
      return cleanHeaders.map((_h, cIdx) =>
        pdf.splitTextToSize(row[cIdx] ?? '', Math.max(18, colWidths[cIdx] - cellPadX * 2)) as string[],
      )
    }

    const firstRowHeight =
      cleanRows.length > 0
        ? Math.max(1, ...computeRowLines(cleanRows[0]).map((l) => l.length)) * lineHeight + 10
        : 0

    const renderTableHeader = () => {
      pdf.setFont('times', 'bold')
      pdf.setFontSize(tableFontSize)
      let x = tableX
      for (let i = 0; i < colCount; i++) {
        const colW = colWidths[i]
        pdf.setFillColor(241, 245, 249)
        pdf.setDrawColor(203, 213, 225)
        pdf.setLineWidth(0.6)
        pdf.rect(x, y, colW, headerHeight, 'FD')

        pdf.setTextColor(15, 23, 42)
        const lines = headerCellLines[i]
        const textBlockH = lines.length * lineHeight
        const startY = y + (headerHeight - textBlockH) / 2 + 11
        lines.forEach((line, lineIdx) => {
          pdf.text(line.trim(), x + colW / 2, startY + lineIdx * lineHeight, {
            align: 'center',
          })
        })
        x += colW
      }
      y += headerHeight
    }

    y += 4
    // Keep table header together with at least the first data row so header never orphans
    ensureSpace(headerHeight + firstRowHeight + 4)
    renderTableHeader()

    for (let rIdx = 0; rIdx < cleanRows.length; rIdx++) {
      const row = cleanRows[rIdx]
      const rowCellLines = computeRowLines(row)
      const maxLines = Math.max(1, ...rowCellLines.map((l) => l.length))
      const rowHeight = maxLines * lineHeight + 10

      if (y + rowHeight > bottomLimit) {
        pdf.addPage()
        y = margin + 12
        renderTableHeader()
      }

      let x = tableX
      for (let cIdx = 0; cIdx < colCount; cIdx++) {
        const colW = colWidths[cIdx]
        pdf.setDrawColor(203, 213, 225)
        pdf.setLineWidth(0.5)
        if (rIdx % 2 === 1) {
          pdf.setFillColor(248, 250, 252)
          pdf.rect(x, y, colW, rowHeight, 'FD')
        } else {
          pdf.rect(x, y, colW, rowHeight, 'S')
        }

        pdf.setFont('times', 'normal')
        pdf.setFontSize(tableFontSize)
        pdf.setTextColor(30, 41, 59)
        const lines = rowCellLines[cIdx]
        const textBlockH = lines.length * lineHeight
        const startY = y + (rowHeight - textBlockH) / 2 + 11
        lines.forEach((line, lineIdx) => {
          pdf.text(line.trim(), x + colW / 2, startY + lineIdx * lineHeight, {
            align: 'center',
          })
        })
        x += colW
      }
      y += rowHeight
    }

    y += 14
  }

  const drawChartFallbackTable = (chart: ChartData) => {
    const headers = [chart.xLabel || 'Category', chart.yLabel || 'Value']
    const rows =
      chart.type === 'elbow'
        ? chart.points.map((p) => [String(p.x), String(p.y)])
        : chart.points.map((p) => [p.label, String(p.value)])
    drawTable(headers, rows)
  }

  const bodyFontSize = 12
  const bodyLineStep = bodyFontSize * 1.5 // 18pt (1.5x line spacing)

  const drawMarkdown = (markdown: string) => {
    if (!markdown.trim()) return
    const withoutCode = markdown.replace(/```[\w+-]*[ \t]*\r?\n[\s\S]*?```/g, '').trim()
    if (!withoutCode) return

    const lines = withoutCode.split('\n')
    let paragraphBuffer: string[] = []

    const flushParagraph = () => {
      if (paragraphBuffer.length === 0) return
      const joined = cleanReportTitle(stripInlineFormatting(paragraphBuffer.join(' ')))
      paragraphBuffer = []
      if (!joined) return

      pdf.setFont('times', 'normal')
      pdf.setFontSize(bodyFontSize)
      pdf.setTextColor(30, 41, 59)
      const wrapped = pdf.splitTextToSize(joined, contentWidth) as string[]
      for (let i = 0; i < wrapped.length; i++) {
        ensureSpace(bodyLineStep)
        drawJustifiedLine(wrapped[i], margin, contentWidth, i === wrapped.length - 1)
        y += bodyLineStep
      }
      y += 6
    }

    for (const rawLine of lines) {
      const trimmed = rawLine.trim()
      if (!trimmed) {
        flushParagraph()
        continue
      }

      if (/^---+$/.test(trimmed)) {
        flushParagraph()
        continue
      }

      const headingMatch = /^(#{1,6})\s+(.*)$/.exec(trimmed)
      if (headingMatch) {
        flushParagraph()
        const level = headingMatch[1].length
        const headingText = cleanHeadingText(headingMatch[2])
        if (!headingText) continue
        // Titles = 14pt bold, Sub-titles = 12pt bold
        const fontSize = level === 1 ? 14 : 12
        const lineStep = fontSize * 1.5
        y += level === 1 ? 10 : 6
        pdf.setFont('times', 'bold')
        pdf.setFontSize(fontSize)
        pdf.setTextColor(15, 23, 42)
        const wrapped = pdf.splitTextToSize(headingText, contentWidth) as string[]
        ensureSpace(wrapped.length * lineStep + 18)
        for (const wLine of wrapped) {
          pdf.text(wLine.trim(), margin, y)
          y += lineStep
        }
        y += 4
        continue
      }

      const quoteMatch = /^>\s?(.*)$/.exec(trimmed)
      if (quoteMatch) {
        flushParagraph()
        const quoteText = cleanReportTitle(stripInlineFormatting(quoteMatch[1]))
        if (!quoteText) continue
        pdf.setFont('times', 'italic')
        pdf.setFontSize(bodyFontSize)
        pdf.setTextColor(51, 65, 85)
        const wrapped = pdf.splitTextToSize(quoteText, contentWidth) as string[]
        for (let i = 0; i < wrapped.length; i++) {
          ensureSpace(bodyLineStep)
          drawJustifiedLine(wrapped[i], margin, contentWidth, i === wrapped.length - 1)
          y += bodyLineStep
        }
        y += 6
        continue
      }

      const listMatch = /^(?:([-*+])|(\d+[.)]))\s+(.*)$/.exec(trimmed)
      if (listMatch) {
        flushParagraph()
        const bullet = listMatch[2] ? listMatch[2] : '•'
        const itemText = cleanReportTitle(stripInlineFormatting(listMatch[3]))
        if (!itemText) continue
        const indent = 18
        pdf.setFont('times', 'normal')
        pdf.setFontSize(bodyFontSize)
        pdf.setTextColor(30, 41, 59)
        const wrapped = pdf.splitTextToSize(itemText, contentWidth - indent) as string[]
        ensureSpace(bodyLineStep)
        pdf.setFont('times', 'bold')
        pdf.text(bullet, margin, y)
        pdf.setFont('times', 'normal')
        for (let i = 0; i < wrapped.length; i++) {
          ensureSpace(bodyLineStep)
          drawJustifiedLine(
            wrapped[i],
            margin + indent,
            contentWidth - indent,
            i === wrapped.length - 1,
          )
          y += bodyLineStep
        }
        y += 3
        continue
      }

      paragraphBuffer.push(trimmed)
    }

    flushParagraph()
  }

  const domMessages = assistantMessageElements()
  const embeddedImages = new Set<string>()
  let assistantIndex = 0
  let mermaidIndex = 0

  for (let index = 0; index < prepared.length; index++) {
    const { message, blocks } = prepared[index]

    if (message.role === 'user') {
      continue
    }

    const dom =
      globalThis.document.querySelector<HTMLElement>(
        `.message-assistant[data-message-id="${message.id}"]`,
      ) ?? domMessages[assistantIndex]
    assistantIndex += 1

    const chartSvgs = dom?.querySelectorAll<SVGSVGElement>(
      '.figure .elbow-chart svg, .figure .series-chart svg',
    )
    const mermaidWrappers = dom?.querySelectorAll<HTMLElement>('.mermaid-wrapper')
    let chartIndex = 0
    let localMermaidIdx = 0

    const msgImages = Array.isArray(message.images)
      ? message.images.map(normalizeImageDataUrl).filter(Boolean)
      : []
    const hasInlineCharts = blocks.some((b) => b.type === 'mermaid' || b.type === 'chart')
    const shouldInterleaveImages = msgImages.length > 0 && !hasInlineCharts
    const hasTables = blocks.some((b) => b.type === 'table')
    let nextImageIdx = 0

    for (let blockIdx = 0; blockIdx < blocks.length; blockIdx++) {
      const block = blocks[blockIdx]

      if (block.type === 'mermaid') {
        const wrapper = mermaidWrappers?.[localMermaidIdx++]
        const switchedSvg = wrapper?.querySelector<SVGSVGElement>('.series-chart svg')
        const switchedDataUrl = switchedSvg ? await chartSvgToDataUrl(switchedSvg) : ''
        const image = switchedDataUrl || mermaidImages[mermaidIndex]
        mermaidIndex += 1
        if (image) {
          drawFigure(image)
        }
        continue
      }

      if (block.type === 'chart') {
        const dataUrl = await chartSvgToDataUrl(chartSvgs?.[chartIndex])
        chartIndex += 1
        if (dataUrl) {
          drawFigure(dataUrl)
        } else {
          drawChartFallbackTable(block.chart)
        }
        continue
      }

      if (block.type === 'table') {
        drawTable(block.headers, block.rows)
      } else {
        drawMarkdown(block.content)
      }

      const placeAfterThisBlock =
        shouldInterleaveImages &&
        nextImageIdx < msgImages.length &&
        (hasTables
          ? block.type === 'table'
          : block.type === 'markdown' && blockIdx < blocks.length - 1)
      if (placeAfterThisBlock) {
        const imgUrl = msgImages[nextImageIdx++]
        embeddedImages.add(imgUrl)
        drawFigure(imgUrl)
      }
    }

    if (shouldInterleaveImages && nextImageIdx < msgImages.length) {
      for (const imgUrl of msgImages.slice(nextImageIdx)) {
        embeddedImages.add(imgUrl)
        drawFigure(imgUrl)
      }
    }

    if (index < prepared.length - 1) {
      y += 10
    }
  }

  const remainingPyImages = (pythonResult?.images ?? [])
    .map(normalizeImageDataUrl)
    .filter((img) => img && !embeddedImages.has(img))

  if (remainingPyImages.length > 0) {
    for (const imgUrl of remainingPyImages) {
      drawFigure(imgUrl)
    }
  }

  onProgress?.('Saving PDF file…')
  pdf.save(`${baseName}_Report.pdf`)
}

/**
 * Word document export (.docx).
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
  const link = globalThis.document.createElement('a')
  link.href = url
  link.download = fileName
  globalThis.document.body.appendChild(link)
  link.click()
  globalThis.document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

function cleanMarkdownForText(markdown: string): string {
  return cleanReportTitle(
    markdown
      .replace(/```[a-z]*\r?\n([\s\S]*?)```/g, '$1')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/^#+\s+/gm, '')
      .replace(/<[^>]*>/g, '')
      .trim(),
  )
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
  const filtered = messages.filter(
    (message) => message.role === 'assistant' && message.content && message.content.trim(),
  )

  let content = filtered.map((message) => cleanMarkdownForText(message.content)).join('\n\n')

  if (pythonResult?.stdout) {
    content += `\n\n${pythonResult.stdout.trim()}\n`
  }

  const blob = new Blob([content.trim() + '\n'], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = globalThis.document.createElement('a')
  link.href = url
  link.download = `${baseName}_Report.txt`
  globalThis.document.body.appendChild(link)
  link.click()
  globalThis.document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
