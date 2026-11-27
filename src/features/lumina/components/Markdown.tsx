import { useState, type ReactNode } from 'react'

export interface DocHeading {
  id: string
  text: string
  level: 2 | 3
}

export function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .replace(/[`*_~[\]()]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function extractDocHeadings(markdown: string): DocHeading[] {
  const headings: DocHeading[] = []
  const lines = markdown.split(/\r?\n/)
  let inCode = false

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (line.startsWith('```')) {
      inCode = !inCode
      continue
    }
    if (inCode) continue

    const h2 = /^##\s+(.+)$/.exec(line)
    if (h2) {
      const text = h2[1].replace(/\*\*/g, '').replace(/`/g, '').trim()
      headings.push({ id: slugifyHeading(text), text, level: 2 })
      continue
    }

    const h3 = /^###\s+(.+)$/.exec(line)
    if (h3) {
      const text = h3[1].replace(/\*\*/g, '').replace(/`/g, '').trim()
      headings.push({ id: slugifyHeading(text), text, level: 3 })
    }
  }

  return headings
}

/** Blocks `javascript:`, `data:`, `vbscript:` or unsafe schemes in user-authored Markdown links. */
export function sanitizeHref(rawHref: string): string {
  const clean = rawHref.trim()
  if (/^(https?:\/\/|mailto:|\/|#)/i.test(clean)) {
    return clean
  }
  return '#'
}

function CopyableCodeBlock({ language, code }: { language: string; code: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    }
  }

  return (
    <div className="lumina-codeblock">
      <div className="lumina-codeblock-header">
        <span className="lumina-codeblock-lang">{language || 'shell'}</span>
        <button
          type="button"
          className="lumina-codeblock-copy"
          onClick={handleCopy}
          aria-label="Copy code"
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="lumina-codeblock-pre">
        <code>{code}</code>
      </pre>
    </div>
  )
}

function renderInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = []
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\)|\*[^*]+\*)/g
  let lastIndex = 0
  let match: RegExpExecArray | null
  let key = 0

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index))
    }
    const token = match[0]
    if (token.startsWith('**') && token.endsWith('**')) {
      nodes.push(<strong key={key++}>{token.slice(2, -2)}</strong>)
    } else if (token.startsWith('`') && token.endsWith('`')) {
      nodes.push(
        <code key={key++} className="lumina-inline-code">
          {token.slice(1, -1)}
        </code>,
      )
    } else if (token.startsWith('[') && token.includes('](') && token.endsWith(')')) {
      const splitIdx = token.indexOf('](')
      const label = token.slice(1, splitIdx)
      const href = sanitizeHref(token.slice(splitIdx + 2, -1))
      const isExternal = /^https?:\/\//i.test(href)
      nodes.push(
        <a
          key={key++}
          href={href}
          className="lumina-inline-link"
          target={isExternal ? '_blank' : undefined}
          rel={isExternal ? 'noopener noreferrer' : undefined}
        >
          {renderInline(label)}
        </a>,
      )
    } else if (token.startsWith('*') && token.endsWith('*')) {
      nodes.push(<em key={key++}>{token.slice(1, -1)}</em>)
    } else {
      nodes.push(token)
    }
    lastIndex = pattern.lastIndex
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex))
  }

  return nodes
}

export function Markdown({ content }: { content: string }) {
  const lines = content.split(/\r?\n/)
  const elements: ReactNode[] = []
  let i = 0
  let blockKey = 0

  while (i < lines.length) {
    const raw = lines[i]
    const trimmed = raw.trim()

    if (!trimmed) {
      i += 1
      continue
    }

    // Fenced code block
    if (trimmed.startsWith('```')) {
      const lang = trimmed.slice(3).trim()
      const codeLines: string[] = []
      i += 1
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i])
        i += 1
      }
      if (i < lines.length) i += 1
      elements.push(
        <CopyableCodeBlock
          key={blockKey++}
          language={lang}
          code={codeLines.join('\n').replace(/^\n+|\n+$/g, '')}
        />,
      )
      continue
    }

    // Callout / Blockquote (> [!NOTE], > [!TIP], > [!IMPORTANT], > [!WARNING])
    if (trimmed.startsWith('>')) {
      const quoteLines: string[] = []
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ''))
        i += 1
      }
      const first = quoteLines[0] || ''
      const alertMatch = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*(.*)$/i.exec(first)
      let kind = 'note'
      let bodyLines = quoteLines
      if (alertMatch) {
        kind = alertMatch[1].toLowerCase()
        const restFirst = alertMatch[2].trim()
        bodyLines = restFirst ? [restFirst, ...quoteLines.slice(1)] : quoteLines.slice(1)
      }
      const bodyText = bodyLines.join(' ').trim()
      elements.push(
        <div key={blockKey++} className={`lumina-callout is-${kind}`} role="note">
          <div className="lumina-callout-badge">{kind.toUpperCase()}</div>
          <div className="lumina-callout-body">{renderInline(bodyText)}</div>
        </div>,
      )
      continue
    }

    // Headings
    const h2 = /^##\s+(.+)$/.exec(trimmed)
    if (h2) {
      const rawText = h2[1].trim()
      const cleanText = rawText.replace(/\*\*/g, '').replace(/`/g, '').trim()
      const id = slugifyHeading(cleanText)
      elements.push(
        <h2 key={blockKey++} id={id} className="lumina-doc-h2">
          <a href={`#${id}`} className="lumina-heading-anchor" aria-hidden="true">
            #
          </a>
          <span>{renderInline(rawText)}</span>
        </h2>,
      )
      i += 1
      continue
    }

    const h3 = /^###\s+(.+)$/.exec(trimmed)
    if (h3) {
      const rawText = h3[1].trim()
      const cleanText = rawText.replace(/\*\*/g, '').replace(/`/g, '').trim()
      const id = slugifyHeading(cleanText)
      elements.push(
        <h3 key={blockKey++} id={id} className="lumina-doc-h3">
          <a href={`#${id}`} className="lumina-heading-anchor" aria-hidden="true">
            #
          </a>
          <span>{renderInline(rawText)}</span>
        </h3>,
      )
      i += 1
      continue
    }

    // Markdown Table
    if (trimmed.startsWith('|') && i + 1 < lines.length && /^\|\s*[-:]+/.test(lines[i + 1].trim())) {
      const headerCells = trimmed
        .split('|')
        .map((c) => c.trim())
        .filter(Boolean)
      i += 2
      const rows: string[][] = []
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        const rowCells = lines[i]
          .trim()
          .split('|')
          .map((c) => c.trim())
          .filter(Boolean)
        if (rowCells.length > 0) rows.push(rowCells)
        i += 1
      }
      elements.push(
        <div key={blockKey++} className="lumina-table-wrap">
          <table className="lumina-table">
            <thead>
              <tr>
                {headerCells.map((cell, idx) => (
                  <th key={idx}>{renderInline(cell)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, rIdx) => (
                <tr key={rIdx}>
                  {r.map((cell, cIdx) => (
                    <td key={cIdx}>{renderInline(cell)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      )
      continue
    }

    // Unordered list
    if (/^[-*]\s+/.test(trimmed)) {
      const items: string[] = []
      while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*]\s+/, ''))
        i += 1
      }
      elements.push(
        <ul key={blockKey++} className="lumina-doc-list">
          {items.map((item, idx) => (
            <li key={idx}>{renderInline(item)}</li>
          ))}
        </ul>,
      )
      continue
    }

    // Ordered list
    if (/^\d+\.\s+/.test(trimmed)) {
      const items: string[] = []
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+\.\s+/, ''))
        i += 1
      }
      elements.push(
        <ol key={blockKey++} className="lumina-doc-list is-ordered">
          {items.map((item, idx) => (
            <li key={idx}>{renderInline(item)}</li>
          ))}
        </ol>,
      )
      continue
    }

    // Paragraph
    const paraLines: string[] = []
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !lines[i].trim().startsWith('```') &&
      !lines[i].trim().startsWith('#') &&
      !lines[i].trim().startsWith('>') &&
      !lines[i].trim().startsWith('|') &&
      !/^[-*]\s+/.test(lines[i].trim()) &&
      !/^\d+\.\s+/.test(lines[i].trim())
    ) {
      paraLines.push(lines[i].trim())
      i += 1
    }
    elements.push(
      <p key={blockKey++} className="lumina-doc-p">
        {renderInline(paraLines.join(' '))}
      </p>,
    )
  }

  return <div className="lumina-markdown">{elements}</div>
}
