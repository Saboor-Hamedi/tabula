import { memo, useRef, useState, type ReactNode } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Components } from 'react-markdown'
import { CheckIcon, CopyIcon, DownloadIcon } from '../common/Icons'
import { CodeBlock } from './CodeBlock'

/**
 * Markdown renderer for assistant prose.
 *
 * GFM tables are wrapped in a scroll container with instant CSV copy & download.
 * Links open in a new tab. Code blocks feature a copy button and interactive
 * execution for Python.
 */

function MarkdownTable({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [copied, setCopied] = useState(false)

  const extractTableData = (): string[][] => {
    const table = ref.current?.querySelector('table')
    if (!table) return []
    const rows = Array.from(table.querySelectorAll('tr'))
    return rows.map((row) =>
      Array.from(row.querySelectorAll('th, td')).map((cell) => (cell.textContent || '').trim()),
    )
  }

  const handleCopyTable = async () => {
    const tableData = extractTableData()
    if (tableData.length === 0) return

    const html = `<table style="border-collapse: collapse; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 10pt; width: 100%;">${tableData
      .map(
        (row, rIdx) => `<tr>${row
          .map((cell) => {
            const isHeader = rIdx === 0
            const tag = isHeader ? 'th' : 'td'
            const bg = isHeader ? 'background-color: #f3f4f6; font-weight: bold;' : ''
            return `<${tag} style="border: 1px solid #d1d5db; padding: 6px 10px; text-align: left; ${bg}">${cell}</${tag}>`
          })
          .join('')}</tr>`,
      )
      .join('')}</table>`

    const tsv = tableData.map((row) => row.join('\t')).join('\n')

    try {
      if (typeof ClipboardItem !== 'undefined') {
        const item = new ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([tsv], { type: 'text/plain' }),
        })
        await navigator.clipboard.write([item])
      } else {
        await navigator.clipboard.writeText(tsv)
      }
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      await navigator.clipboard.writeText(tsv)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    }
  }

  const handleDownload = () => {
    const tableData = extractTableData()
    if (tableData.length === 0) return
    const csv = tableData
      .map((row) =>
        row
          .map((cell) => {
            const raw = cell.replace(/"/g, '""')
            return raw.includes(',') || raw.includes('\n') || raw.includes('"') ? `"${raw}"` : raw
          })
          .join(','),
      )
      .join('\n')

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `table-${Date.now().toString(36)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="md-table-container" ref={ref}>
      <div className="md-table-wrap">
        <table>{children}</table>
      </div>
      <div className="md-table-toolbar">
        <button
          type="button"
          className="tool-btn"
          onClick={handleCopyTable}
          title="Copy Word & Google Docs ready formatted table"
        >
          {copied ? <CheckIcon size={12} /> : <CopyIcon size={12} />}
          <span>{copied ? 'Copied Table!' : 'Copy as table'}</span>
        </button>
        <button type="button" className="tool-btn" onClick={handleDownload} title="Download table as CSV">
          <DownloadIcon size={12} />
          <span>Download CSV</span>
        </button>
      </div>
    </div>
  )
}

const components: Components = {
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noreferrer noopener">
      {children}
    </a>
  ),
  table: ({ children }) => <MarkdownTable>{children}</MarkdownTable>,
  pre: ({ children }) => <>{children}</>,
  code: ({ className, children, ...props }) => {
    const text = String(children).replace(/\n$/, '')
    const isBlock = Boolean(className) || text.includes('\n')
    if (isBlock) {
      return <CodeBlock code={text} className={className} />
    }
    return (
      <code className={className} {...props}>
        {children}
      </code>
    )
  },
}

export const MarkdownText = memo(function MarkdownText({ content }: { content: string }) {
  return (
    <div className="markdown">
      <Markdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </Markdown>
    </div>
  )
})
