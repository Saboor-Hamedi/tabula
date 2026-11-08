/**
 * Lightweight crash diagnostics.
 *
 * The app is local-first and has no server, so errors are kept in session
 * storage for the current tab and mirrored to the console with a stable shape.
 * This gives enough context to debug a failure without shipping a third-party
 * monitoring service or collecting user data.
 */

const STORAGE_KEY = 'data-agent:diagnostics'

export interface DiagnosticEvent {
  id: string
  at: string
  source: 'boundary' | 'promise' | 'window'
  message: string
  stack: string | null
  context: Record<string, unknown>
}

function readEvents(): DiagnosticEvent[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as DiagnosticEvent[]) : []
  } catch {
    return []
  }
}

function writeEvents(events: DiagnosticEvent[]): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(events.slice(-20)))
  } catch {
    // Diagnostics are best-effort.
  }
}

export function reportDiagnostic(
  error: unknown,
  source: DiagnosticEvent['source'],
  context: Record<string, unknown> = {},
): DiagnosticEvent {
  const normalized = error instanceof Error ? error : new Error(String(error))
  const event: DiagnosticEvent = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    at: new Date().toISOString(),
    source,
    message: normalized.message,
    stack: normalized.stack ?? null,
    context,
  }

  const events = readEvents()
  events.push(event)
  writeEvents(events)

  console.error(`[Tabula:${source}]`, normalized, context)
  return event
}

export function getDiagnostics(): DiagnosticEvent[] {
  return readEvents()
}

export function clearDiagnostics(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // Ignore private-browsing failures.
  }
}

/** Installs global handlers once, from the app entry point. */
export function installGlobalErrorHandlers(): () => void {
  const handleError = (event: ErrorEvent) => {
    reportDiagnostic(event.error ?? event.message, 'window', {
      filename: event.filename,
      line: event.lineno,
      column: event.colno,
    })
  }

  const handleRejection = (event: PromiseRejectionEvent) => {
    reportDiagnostic(event.reason, 'promise')
  }

  window.addEventListener('error', handleError)
  window.addEventListener('unhandledrejection', handleRejection)

  return () => {
    window.removeEventListener('error', handleError)
    window.removeEventListener('unhandledrejection', handleRejection)
  }
}
