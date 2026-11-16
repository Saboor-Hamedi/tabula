import type { Paragraph, Table, TableCell, TableRow, TextRun } from 'docx'
import { stripLeadingPreamble } from '../agent/runAgentTurn'
import { parseMessageContent } from '../parsing/parseMessage'
import type { PythonExecutionResult } from '../python/types'
import type { ChartData, ChatMessage, Session } from '../types'
import { svgToPngBlob } from '../utils/image'
import { renderMermaidPngBatch } from './mermaidExport'

/**
 * Word (.docx) export.
 *
 * Builds a real Office Open XML document instead of HTML saved as .doc: Word
 * reliably displays embedded images in .docx, keeps native tables editable, and
 * never opens blank. Typography is 12pt body/headings with compact 9pt tables.
 */

type Docx = typeof import('docx')
type DocChild = Paragraph | Table

const BODY_SIZE = 24 // half-points → 12pt
const TITLE_SIZE = 28 // half-points → 14pt
const TABLE_SIZE = 24 // half-points → 12pt
const CODE_SIZE = 18
const HEADING_COLOR = '0F172A'
const BORDER_COLOR = 'CBD5E1'
/** 2 cm on every A4 edge, in twips. */
const PAGE_MARGIN_TWIPS = Math.round((2 / 2.54) * 1440)

interface InlineToken {
  text: string
  bold?: boolean
  italics?: boolean
  code?: boolean
}

function tokenizeInline(text: string): InlineToken[] {
  const tokens: InlineToken[] = []
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g
  let lastIndex = 0
  let match = pattern.exec(text)

  while (match) {
    if (match.index > lastIndex) {
      tokens.push({ text: text.slice(lastIndex, match.index) })
    }
    const token = match[0]
    if (token.startsWith('**')) {
      tokens.push({ text: token.slice(2, -2), bold: true })
    } else if (token.startsWith('`')) {
      tokens.push({ text: token.slice(1, -1), code: true })
    } else {
      tokens.push({ text: token.slice(1, -1), italics: true })
    }
    lastIndex = match.index + token.length
    match = pattern.exec(text)
  }

  if (lastIndex < text.length) tokens.push({ text: text.slice(lastIndex) })
  return tokens.length > 0 ? tokens : [{ text }]
}

function cleanDisplayText(raw: string): string {
  return (raw || '')
    .replace(/\.(csv|xlsx|xls|tsv|parquet)\b/gi, '')
    .replace(/([_-]merged)+/gi, ' ')
    .replace(/[_-]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function stripMarkdown(text: string): string {
  return cleanDisplayText(
    tokenizeInline(text)
      .map((token) => token.text)
      .join(''),
  )
}

function inlineRuns(docx: Docx, text: string): TextRun[] {
  return tokenizeInline(cleanDisplayText(text)).map(
    (token) =>
      new docx.TextRun({
        text: token.text,
        bold: token.bold,
        italics: token.italics,
        font: token.code ? 'Consolas' : 'Times New Roman',
        size: BODY_SIZE,
        color: '1E293B',
      }),
  )
}

function paragraphFromLines(docx: Docx, lines: string[]): Paragraph {
  const joined = lines.map((l) => l.trim()).filter(Boolean).join(' ')
  return new docx.Paragraph({
    alignment: docx.AlignmentType.JUSTIFIED,
    spacing: { line: 360, after: 140 },
    children: inlineRuns(docx, joined),
  })
}

function pushCode(docx: Docx, children: DocChild[], code: string): void {
  const lines = (code || ' ').split('\n')
  lines.forEach((line) => {
    children.push(
      new docx.Paragraph({
        spacing: { after: 0, before: 0 },
        shading: { fill: 'F8FAFC' },
        children: [
          new docx.TextRun({
            text: line.length > 0 ? line : ' ',
            font: 'Consolas',
            size: CODE_SIZE,
            color: '0F172A',
          }),
        ],
      }),
    )
  })
  children.push(new docx.Paragraph({ spacing: { after: 80 }, children: [] }))
}

function isListItem(line: string): boolean {
  return /^\s*(?:[-*+]|\d+[.)])\s+/.test(line)
}

function pushList(docx: Docx, children: DocChild[], chunk: string): void {
  const lines = chunk.split('\n').filter((line) => line.trim().length > 0)
  const ordered = /^\s*\d+[.)]\s+/.test(lines[0] ?? '')

  lines.forEach((line, index) => {
    const text = line.replace(/^\s*(?:[-*+]|\d+[.)])\s+/, '')
    children.push(
      new docx.Paragraph({
        alignment: docx.AlignmentType.JUSTIFIED,
        bullet: ordered ? undefined : { level: 0 },
        indent: ordered ? { left: 360 } : undefined,
        spacing: { line: 360, after: 80 },
        children: [
          ...(ordered
            ? [new docx.TextRun({ text: `${index + 1}. `, size: BODY_SIZE, font: 'Times New Roman' })]
            : []),
          ...inlineRuns(docx, text),
        ],
      }),
    )
  })
}

function pushChunk(docx: Docx, children: DocChild[], chunk: string): void {
  const lines = chunk.split('\n')

  if (lines.every((line) => !line.trim() || isListItem(line))) {
    pushList(docx, children, chunk)
    return
  }

  let paragraphLines: string[] = []
  const flush = () => {
    if (paragraphLines.length === 0) return
    children.push(paragraphFromLines(docx, paragraphLines))
    paragraphLines = []
  }

  for (const line of lines) {
    if (/^\s*---+\s*$/.test(line)) {
      flush()
      continue
    }

    const heading = /^(#{1,6})\s+(.*)$/.exec(line.trim())
    if (heading) {
      flush()
      const level = heading[1].length
      children.push(
        new docx.Paragraph({
          spacing: { before: 200, after: 80, line: 360 },
          children: [
            new docx.TextRun({
              text: stripMarkdown(heading[2]),
              bold: true,
              size: level === 1 ? TITLE_SIZE : BODY_SIZE,
              color: HEADING_COLOR,
              font: 'Times New Roman',
            }),
          ],
        }),
      )
      continue
    }

    const quote = /^\s*>\s?(.*)$/.exec(line)
    if (quote) {
      flush()
      children.push(
        new docx.Paragraph({
          alignment: docx.AlignmentType.JUSTIFIED,
          indent: { left: 360 },
          spacing: { line: 360, after: 100 },
          children: [
            new docx.TextRun({
              text: stripMarkdown(quote[1]),
              italics: true,
              size: BODY_SIZE,
              color: '475569',
              font: 'Times New Roman',
            }),
          ],
        }),
      )
      continue
    }

    if (isListItem(line)) {
      flush()
      children.push(
        new docx.Paragraph({
          alignment: docx.AlignmentType.JUSTIFIED,
          bullet: { level: 0 },
          spacing: { line: 360, after: 80 },
          children: inlineRuns(docx, line.replace(/^\s*(?:[-*+]|\d+[.)])\s+/, '')),
        }),
      )
      continue
    }

    paragraphLines.push(line)
  }

  flush()
}

function pushMarkdown(docx: Docx, children: DocChild[], markdown: string): void {
  if (!markdown.trim()) return

  const codeBlocks: string[] = []
  const normalized = markdown.replace(
    /```([\w+-]*)[ \t]*\r?\n([\s\S]*?)```/g,
    (_match, _lang, code: string) => {
      const index = codeBlocks.length
      codeBlocks.push(code.replace(/\n$/, ''))
      return `\n\n@@TABULA_CODE_${index}@@\n\n`
    },
  )

  for (const raw of normalized.split(/\n{2,}/)) {
    const chunk = raw.trim()
    if (!chunk) continue
    const placeholder = /^@@TABULA_CODE_(\d+)@@$/.exec(chunk)
    if (placeholder) {
      pushCode(docx, children, codeBlocks[Number(placeholder[1])] ?? '')
      continue
    }
    pushChunk(docx, children, chunk)
  }
}

function cell(
  docx: Docx,
  text: string,
  header: boolean,
  width: number,
): TableCell {
  return new docx.TableCell({
    width: { size: width, type: docx.WidthType.PERCENTAGE },
    verticalAlign: docx.VerticalAlign.CENTER,
    shading: header ? { fill: 'F1F5F9' } : undefined,
    children: [
      new docx.Paragraph({
        alignment: docx.AlignmentType.CENTER,
        spacing: { before: 40, after: 40, line: 280 },
        children: [
          new docx.TextRun({
            text: stripMarkdown(text),
            bold: header,
            size: TABLE_SIZE,
            color: header ? '0F172A' : '1E293B',
            font: 'Times New Roman',
          }),
        ],
      }),
    ],
  })
}

function pushTable(
  docx: Docx,
  children: DocChild[],
  headers: string[],
  rows: string[][],
): void {
  if (headers.length === 0) return

  const width = Math.max(1, Math.floor(100 / headers.length))
  const borders = {
    top: { style: docx.BorderStyle.SINGLE, size: 4, color: BORDER_COLOR },
    bottom: { style: docx.BorderStyle.SINGLE, size: 4, color: BORDER_COLOR },
    left: { style: docx.BorderStyle.SINGLE, size: 4, color: BORDER_COLOR },
    right: { style: docx.BorderStyle.SINGLE, size: 4, color: BORDER_COLOR },
    insideHorizontal: { style: docx.BorderStyle.SINGLE, size: 4, color: BORDER_COLOR },
    insideVertical: { style: docx.BorderStyle.SINGLE, size: 4, color: BORDER_COLOR },
  }

  const tableRows: TableRow[] = [
    new docx.TableRow({
      tableHeader: true,
      cantSplit: true,
      children: headers.map((header) => cell(docx, header, true, width)),
    }),
    ...rows.map(
      (row) =>
        new docx.TableRow({
          cantSplit: true,
          children: headers.map((_header, index) => cell(docx, row[index] ?? '', false, width)),
        }),
    ),
  ]

  children.push(
    new docx.Table({
      alignment: docx.AlignmentType.CENTER,
      width: { size: 100, type: docx.WidthType.PERCENTAGE },
      borders,
      rows: tableRows,
    }),
  )
  children.push(new docx.Paragraph({ spacing: { after: 100 }, children: [] }))
}

function normalizeImageDataUrl(img: string): string {
  const trimmed = (img || '').trim()
  if (!trimmed) return ''
  return trimmed.startsWith('data:image/') ? trimmed : `data:image/png;base64,${trimmed}`
}

function pngDimensions(dataUrl: string): { width: number; height: number } {
  try {
    const clean = normalizeImageDataUrl(dataUrl)
    const base64 = clean.slice(clean.lastIndexOf(',') + 1)
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index)
    const view = new DataView(bytes.buffer)
    return { width: view.getUint32(16), height: view.getUint32(20) }
  } catch {
    return { width: 640, height: 360 }
  }
}

function imageParagraph(docx: Docx, rawDataUrl: string): Paragraph {
  const dataUrl = normalizeImageDataUrl(rawDataUrl)
  const { width, height } = pngDimensions(dataUrl)
  const maxWidth = 480
  let renderWidth = Math.min(maxWidth, width || maxWidth)
  let renderHeight = Math.round((renderWidth * height) / (width || maxWidth))
  if (renderHeight > 280) {
    renderHeight = 280
    renderWidth = Math.round((renderHeight * width) / (height || 1))
  }

  return new docx.Paragraph({
    alignment: docx.AlignmentType.CENTER,
    spacing: { before: 80, after: 120 },
    children: [
      new docx.ImageRun({
        type: 'png',
        data: dataUrl,
        transformation: { width: renderWidth, height: renderHeight },
      }),
    ],
  })
}

function chartToTable(docx: Docx, children: DocChild[], chart: ChartData): void {
  children.push(
    new docx.Paragraph({
      spacing: { before: 120, after: 40 },
      children: [
        new docx.TextRun({
          text: chart.title,
          bold: true,
          size: BODY_SIZE,
          color: HEADING_COLOR,
        }),
      ],
    }),
  )

  if (chart.note) pushMarkdown(docx, children, chart.note)

  if (chart.type === 'elbow') {
    pushTable(
      docx,
      children,
      [chart.xLabel, chart.yLabel],
      chart.points.map((point) => [String(point.x), String(point.y)]),
    )
    return
  }

  pushTable(
    docx,
    children,
    [chart.xLabel, chart.yLabel],
    chart.points.map((point) => [point.label, String(point.value)]),
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
  } catch {
    return ''
  }
}

function assistantMessageElements(): HTMLElement[] {
  return Array.from(
    document.querySelectorAll<HTMLElement>('.chat-column .message.message-assistant'),
  )
}

interface PreparedMessage {
  message: ChatMessage
  blocks: ReturnType<typeof parseMessageContent>
}

export async function buildDocxReport(
  session: Session,
  messages: ChatMessage[],
  pythonResult?: PythonExecutionResult | null,
  onProgress?: (status: string) => void,
): Promise<{ blob: Blob; fileName: string }> {
  const docx = await import('docx')
  const baseName =
    cleanDisplayText(session.fileName)
      .replace(/[^a-zA-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'Report'
  const validMessages = messages.filter((message) => message.content && message.content.trim())

  const prepared: PreparedMessage[] = validMessages.map((message) => ({
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

  const domMessages = assistantMessageElements()
  const children: DocChild[] = []
  const embeddedImages = new Set<string>()
  let assistantIndex = 0
  let mermaidIndex = 0

  for (let messageIndex = 0; messageIndex < prepared.length; messageIndex++) {
    const { message, blocks } = prepared[messageIndex]

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
        const switchedImage = switchedSvg ? await chartSvgToDataUrl(switchedSvg) : ''
        const image = switchedImage || mermaidImages[mermaidIndex]
        mermaidIndex += 1
        if (image) {
          children.push(imageParagraph(docx, image))
        } else {
          pushCode(docx, children, block.code)
        }
        continue
      }

      if (block.type === 'chart') {
        const image = await chartSvgToDataUrl(chartSvgs?.[chartIndex])
        chartIndex += 1
        if (image) children.push(imageParagraph(docx, image))
        else chartToTable(docx, children, block.chart)
        continue
      }

      if (block.type === 'table') {
        pushTable(docx, children, block.headers, block.rows)
      } else {
        pushMarkdown(docx, children, block.content)
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
        children.push(imageParagraph(docx, imgUrl))
      }
    }

    if (shouldInterleaveImages && nextImageIdx < msgImages.length) {
      for (const imgUrl of msgImages.slice(nextImageIdx)) {
        embeddedImages.add(imgUrl)
        children.push(imageParagraph(docx, imgUrl))
      }
    }
  }

  const remainingPyImages = (pythonResult?.images ?? [])
    .map(normalizeImageDataUrl)
    .filter((img) => img && !embeddedImages.has(img))

  if (remainingPyImages.length > 0) {
    remainingPyImages.forEach((image) => {
      children.push(imageParagraph(docx, image))
    })
  }

  const wordDoc = new docx.Document({
    styles: {
      default: {
        document: {
          run: { font: 'Times New Roman', size: BODY_SIZE, color: '1E293B' },
          paragraph: {
            alignment: docx.AlignmentType.JUSTIFIED,
            spacing: { line: 360, after: 140 },
          },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: PAGE_MARGIN_TWIPS,
              right: PAGE_MARGIN_TWIPS,
              bottom: PAGE_MARGIN_TWIPS,
              left: PAGE_MARGIN_TWIPS,
            },
          },
        },
        children,
      },
    ],
  })

  const blob = await docx.Packer.toBlob(wordDoc)
  return { blob, fileName: `${baseName}_Report.docx` }
}
