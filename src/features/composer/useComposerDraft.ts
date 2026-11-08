import { useCallback, useSyncExternalStore } from 'react'

/**
 * Composer draft store.
 *
 * The draft lives outside React state so it survives re-renders, dataset
 * switches and modal opens. `useSyncExternalStore` gives every consumer the
 * same value without a context provider.
 */

let draft = ''
const listeners = new Set<() => void>()

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getSnapshot(): string {
  return draft
}

function setDraft(next: string): void {
  draft = next
  for (const listener of listeners) listener()
}

/** Returns the current draft and a setter. */
export function useComposerDraft(): [string, (value: string) => void] {
  const value = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  const set = useCallback((next: string) => setDraft(next), [])
  return [value, set]
}

/** Clears the draft. Used when a session is deleted. */
export function clearComposerDraft(): void {
  setDraft('')
}
