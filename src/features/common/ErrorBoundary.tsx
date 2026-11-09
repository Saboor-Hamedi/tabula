import { Component, type ErrorInfo, type ReactNode } from 'react'
import { clearDiagnostics, getDiagnostics, reportDiagnostic } from '../../core/diagnostics'
import { AlertIcon, RefreshIcon } from './Icons'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  error: Error | null
}

/**
 * Last line of defence for rendering failures. The fallback offers a safe
 * reload and a small diagnostic log that never leaves the browser tab.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidMount(): void {
    try {
      const saved = localStorage.getItem('tabula-theme')
      if (saved === 'light' || saved === 'dark') {
        document.documentElement.setAttribute('data-theme', saved)
      }
    } catch {
      // ignore
    }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    reportDiagnostic(error, 'boundary', { componentStack: info.componentStack ?? '' })
    try {
      const saved = localStorage.getItem('tabula-theme')
      if (saved === 'light' || saved === 'dark') {
        document.documentElement.setAttribute('data-theme', saved)
      }
    } catch {
      // ignore
    }
  }

  private handleReload = () => {
    window.location.reload()
  }

  private handleCopy = async () => {
    const diagnostics = getDiagnostics()
    try {
      await navigator.clipboard.writeText(JSON.stringify(diagnostics, null, 2))
    } catch {
      // Clipboard permission is optional.
    }
  }

  private handleClear = () => {
    clearDiagnostics()
    this.setState({ error: null })
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div className="crash-screen" role="alert">
        <div className="crash-card">
          <span className="crash-icon" aria-hidden>
            <AlertIcon size={22} />
          </span>
          <h1>Something went wrong</h1>
          <p>
            Your data is still in this browser. Reload to recover, or copy the local
            diagnostic log if the problem repeats.
          </p>
          <pre className="crash-message">{this.state.error.message}</pre>
          <div className="crash-actions">
            <button type="button" className="btn btn-primary" onClick={this.handleReload}>
              <RefreshIcon size={15} />
              <span>Reload app</span>
            </button>
            <button type="button" className="btn" onClick={() => void this.handleCopy()}>
              Copy error details
            </button>
            <button type="button" className="btn btn-ghost" onClick={this.handleClear}>
              Try again
            </button>
          </div>
        </div>
      </div>
    )
  }
}
