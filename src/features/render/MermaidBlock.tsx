import { lazy, Suspense } from 'react'
import { MermaidFallback } from './MermaidFallback'

const MermaidDiagram = lazy(() => import('./MermaidDiagram'))

export function MermaidBlock({ code }: { code: string }) {
  return (
    <div className="mermaid-block">
      <div className="mermaid-badge">Chart</div>
      <Suspense fallback={<MermaidFallback code={code} />}>
        <MermaidDiagram code={code} />
      </Suspense>
    </div>
  )
}
