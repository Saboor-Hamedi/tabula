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
        <span>{message ?? (tone === 'loading' ? 'Rendering diagram…' : 'Could not render diagram')}</span>
      </div>
      {code ? <pre className="mermaid-source">{code}</pre> : null}
    </div>
  )
}
