import React, { lazy, Suspense } from 'react'
import { MermaidFallback } from './MermaidFallback'

const MermaidDiagram = lazy(() => import('./MermaidDiagram'))

export interface MermaidImageBoxProps {
  code: string
  inView?: boolean
  containerRef?: React.RefObject<HTMLDivElement | null>
}

/**
 * MermaidImageBox: Dedicated diagram display container.
 * Renders the rendered diagram canvas with lazy-loading and suspense fallback.
 */
export function MermaidImageBox({
  code,
  inView = true,
  containerRef,
}: MermaidImageBoxProps) {
  return (
    <div className="mermaid-diagram-canvas mermaid-image-box" ref={containerRef}>
      {inView ? (
        <Suspense fallback={<MermaidFallback />}>
          <MermaidDiagram code={code} />
        </Suspense>
      ) : (
        <MermaidFallback />
      )}
    </div>
  )
}
