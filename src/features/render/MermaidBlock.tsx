import { lazy, Suspense } from 'react'
import { hasOpenFence } from '../../core/parsing/parseMessage'
import { useInView } from '../common/useInView'
import { Figure } from './Figure'
import { MermaidFallback } from './MermaidFallback'

/**
 * Mermaid block.
 *
 * Two guards keep frequent chatting cheap:
 *  - the diagram component is lazy, so Mermaid is not in the initial bundle;
 *  - while the message is still streaming, an unterminated fence renders as a
 *    lightweight placeholder instead of attempting a render on every token.
 */

const MermaidDiagram = lazy(() => import('./MermaidDiagram'))

export interface MermaidBlockProps {
  code: string
  streaming?: boolean
}

/** Derives a stable, file-safe name from the diagram's own title. */
function figureName(code: string): string {
  const titleMatch = /title\s+"?([^"\n]+)"?/i.exec(code)
  const base = titleMatch ? titleMatch[1] : 'chart'
  const slug = base
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
  return `tabula-${slug || 'chart'}`
}

export function MermaidBlock({ code, streaming = false }: MermaidBlockProps) {
  const { ref, inView } = useInView<HTMLDivElement>()

  // A half-written diagram would render as a syntax error and then remount.
  if (streaming && hasOpenFence(code)) {
    return <MermaidFallback code={code} />
  }

  return (
    <div className="mermaid-viewport" ref={ref}>
      {inView ? (
        <Figure name={figureName(code)}>
          <Suspense fallback={<MermaidFallback />}>
            <MermaidDiagram code={code} />
          </Suspense>
        </Figure>
      ) : (
        <MermaidFallback />
      )}
    </div>
  )
}
