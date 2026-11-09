import { memo } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Components } from 'react-markdown'
import { CodeBlock } from './CodeBlock'

/**
 * Markdown renderer for assistant prose.
 *
 * GFM tables are wrapped in a scroll container so a wide table never stretches
 * the message column. Links open in a new tab. Code blocks feature a copy button
 * and interactive execution for Python.
 */

const components: Components = {
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noreferrer noopener">
      {children}
    </a>
  ),
  table: ({ children }) => (
    <div className="md-table-wrap">
      <table>{children}</table>
    </div>
  ),
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
