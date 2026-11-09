export interface MermaidFallbackProps {
  code?: string
  message?: string
  tone?: 'loading' | 'error'
}

export function MermaidFallback({ code, message, tone = 'loading' }: MermaidFallbackProps) {
  return (
    <div className={`mermaid-fallback ${tone === 'error' ? 'is-error' : ''}`}>
      <div className="mermaid-fallback-head">
        <span>{tone === 'error' ? 'Diagram syntax error' : 'Rendering chart…'}</span>
        {message ? <span>— {message}</span> : null}
      </div>
      {code && tone === 'error' ? <pre className="mermaid-source">{code}</pre> : null}
    </div>
  )
}
