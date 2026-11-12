import { memo, useMemo } from 'react'
import type { FigureChanges } from '../../../core/parsing/editFigure'
import { parseMessageContent } from '../../../core/parsing/parseMessage'
import { ContentBlocks } from '../../render/ContentBlocks'

/**
 * Renders one assistant message.
 *
 * Parsing is memoized on the content string, and each block is a memoized
 * component, so a streaming token only re-renders the block it lands in. That is
 * what keeps long conversations with charts and tables responsive.
 */

export interface MessageRendererProps {
  content: string
  /** While streaming, hold back chart rendering until fences close. */
  streaming?: boolean
  onEditFigure?: (figureIndex: number, changes: FigureChanges) => void
}

export const Renderer = memo(function Renderer({
  content,
  streaming = false,
  onEditFigure,
}: MessageRendererProps) {
  const blocks = useMemo(() => parseMessageContent(content), [content])

  return (
    <div className="message-content">
      <ContentBlocks
        blocks={blocks}
        streaming={streaming}
        onEditFigure={onEditFigure}
      />
    </div>
  )
})
