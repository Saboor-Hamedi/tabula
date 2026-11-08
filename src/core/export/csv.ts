import { stripInlineMarkdown } from '../parsing/inlineMarkdown'

function escapeCell(value: string): string {
  const text = stripInlineMarkdown(value).replace(/\r?\n/g, ' ').trim()
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

/** Builds a CSV from already-displayed table data. */
export function buildCsv(headers: string[], rows: string[][]): string {
  const lines = [headers.map(escapeCell).join(',')]
  for (const row of rows) {
    lines.push(headers.map((_header, index) => escapeCell(row[index] ?? '')).join(','))
  }
  return lines.join('\n')
}

export function downloadCsv(fileName: string, csv: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}
