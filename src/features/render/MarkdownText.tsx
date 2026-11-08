import { memo } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Components } from 'react-markdown'

/**
 * Markdown renderer for assistant prose.
 *
 * GFM tables are wrapped in a scroll container so a wide table never stretches
 * the message column. Links open in a new tab.
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
