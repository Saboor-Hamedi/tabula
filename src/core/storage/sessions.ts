import type { Session } from '../types'

let registry: Session[] = []

export function getSessionRegistry(): readonly Session[] {
  return registry
}

export function registerSession(session: Session): void {
  registry = [...registry.filter((entry) => entry.id !== session.id), session]
}

export function unregisterSession(sessionId: string): void {
  registry = registry.filter((entry) => entry.id !== sessionId)
}

export function clearSessionRegistry(): void {
  registry = []
}

export function findSession(sessionId: string): Session | null {
  return registry.find((entry) => entry.id === sessionId) ?? null
}
