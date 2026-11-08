/**
 * Placeholder shown while a diagram renders, or when its syntax is invalid.
 *
 * The source is shown on error so the failure is diagnosable instead of silent.
 */

export interface MermaidFallbackProps {
  code?: string
  message?: string
  tone?: 'loading' | 'error'
}

export function MermaidFallback({ code, message, tone = 'loading' }: MermaidFallbackProps) {
  return (
    <div className={`mermaid-fallback ${tone === 'error' ? 'is-error' : ''}`}>
      <div className="mermaid-fallback-head">
        {tone === 'loading' ? <span className="spinner" aria-hidden /> : null}
        <span>{message ?? (tone === 'loading' ? 'Rendering chart…' : 'Could not render chart')}</span>
      </div>
      {code && tone === 'error' ? <pre className="mermaid-source">{code}</pre> : null}
    </div>
  )
}
