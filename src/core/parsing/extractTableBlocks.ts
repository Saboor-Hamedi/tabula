import type { RawBlock } from '../types'

function splitRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '')
  const cells: string[] = []
  let current = ''
  let index = 0

  while (index < trimmed.length) {
    const char = trimmed[index]
    if (char === '\\' && trimmed[index + 1] === '|') {
      current += '|'
      index += 2
      continue
    }
    if (char === '|') {
      cells.push(current.trim())
      current = ''
      index += 1
      continue
    }
    current += char
    index += 1
  }

  cells.push(current.trim())
  return cells
}

function looksLikeSeparator(line: string): boolean {
  const trimmed = line.trim()
  if (!trimmed.includes('-')) return false
  if (!trimmed.includes('|')) return false
  return /^\|?\s*:?-{1,}:?\s*(\|\s*:?-{1,}:?\s*)+\|?$/.test(trimmed)
}

function looksLikeTableHeader(line: string): boolean {
  const trimmed = line.trim()
  if (!trimmed.includes('|')) return false
  return trimmed.split('|').length >= 3
}

function isCodeFence(line: string): boolean {
  return /^\s*(`{3,}|~{3,})/.test(line)
}

export function extractTableBlocks(text: string): RawBlock[] {
  const lines = text.split('\n')
  const blocks: RawBlock[] = []
  let buffer: string[] = []
  let inCode = false
  let codeFence = ''
  let index = 0

  const flushMarkdown = () => {
    if (buffer.length === 0) return
    blocks.push({ type: 'markdown', content: buffer.join('\n') })
    buffer = []
  }

  while (index < lines.length) {
    const line = lines[index]

    if (inCode) {
      buffer.push(line)
      if (line.trim().startsWith(codeFence)) {
        inCode = false
        codeFence = ''
      }
      index += 1
      continue
    }

    if (isCodeFence(line)) {
      inCode = true
      codeFence = line.trim().startsWith('~') ? '~~~' : '```'
      buffer.push(line)
      index += 1
      continue
    }

    const next = lines[index + 1]
    if (next !== undefined && looksLikeTableHeader(line) && looksLikeSeparator(next)) {
      flushMarkdown()
      const headers = splitRow(line)
      const rows: string[][] = []
      index += 2

      while (index < lines.length) {
        const rowLine = lines[index]
        if (rowLine.trim().length === 0 || !rowLine.includes('|')) break
        if (isCodeFence(rowLine)) break
        const cells = splitRow(rowLine)
        if (cells.length === 0) break
        const normalized = headers.map((_header, cellIndex) => cells[cellIndex] ?? '')
        rows.push(normalized)
        index += 1
      }

      blocks.push({ type: 'table', headers, rows })
      continue
    }

    buffer.push(line)
    index += 1
  }

  flushMarkdown()
  return blocks
}
