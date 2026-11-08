import { useMemo } from 'react'
import { parseMessageContent } from '../../core/parsing/parseMessage'
import { MarkdownText } from '../render/MarkdownText'
import { MermaidBlock } from '../render/MermaidBlock'
import { DataTable } from '../render/DataTable'

export function MessageRenderer({ content }: { content: string }) {
  const blocks = useMemo(() => parseMessageContent(content), [content])

  return (
    <div className="message-content">
      {blocks.map((block, index) => {
        if (block.type === 'mermaid') {
          return <MermaidBlock key={`mermaid-${index}`} code={block.code} />
        }
        if (block.type === 'table') {
          return (
            <DataTable key={`table-${index}`} headers={block.headers} rows={block.rows} />
          )
        }
        return <MarkdownText key={`markdown-${index}`} content={block.content} />
      })}
    </div>
  )
}
