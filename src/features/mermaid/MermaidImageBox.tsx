import { Component, Suspense, type ErrorInfo, type ReactNode } from 'react'
import { reportDiagnostic } from '../../core/diagnostics'
import { lazyWithRetry } from '../../core/utils/lazyWithRetry'
import { MermaidFallback } from './MermaidFallback'

const MermaidDiagram = lazyWithRetry(() => import('./MermaidDiagram'))

export interface MermaidImageBoxProps {
  code: string
  inView?: boolean
  containerRef?: React.RefObject<HTMLDivElement | null>
}

/**
 * Keeps a single broken diagram from taking the page down with it.
 *
 * The lazy import of Mermaid can fail for a single chunk; the rest of the
 * answer (text, tables, other diagrams) must still render.
 */
class DiagramBoundary extends Component<
  { children: ReactNode; code: string },
  { failed: boolean }
> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    reportDiagnostic(error, 'boundary', { componentStack: info.componentStack ?? '' })
  }

  render() {
    if (this.state.failed) {
      return (
        <MermaidFallback
          code={this.props.code}
          tone="error"
          message="This diagram could not be loaded."
        />
      )
    }
    return this.props.children
  }
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
        <DiagramBoundary code={code}>
          <Suspense fallback={<MermaidFallback />}>
            <MermaidDiagram code={code} />
          </Suspense>
        </DiagramBoundary>
      ) : (
        <MermaidFallback />
      )}
    </div>
  )
}
