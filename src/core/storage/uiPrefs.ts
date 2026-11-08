import { STORAGE_KEYS } from '../constants'

/**
 * UI preference persistence (sidebar and inspector open state).
 *
 * These are layout choices, not data. They live in localStorage so the shell
 * reopens the way the user left it, and they never touch the session store.
 */

function readFlag(key: string, fallback: boolean): boolean {
  try {
    const raw = window.localStorage.getItem(key)
    if (raw === null) return fallback
    return raw === '1'
  } catch {
    return fallback
  }
}

function writeFlag(key: string, value: boolean): void {
  try {
    window.localStorage.setItem(key, value ? '1' : '0')
  } catch {
    // Private browsing: layout simply falls back to defaults next load.
  }
}

export function getSidebarOpen(defaultOpen: boolean): boolean {
  return readFlag(STORAGE_KEYS.sidebar, defaultOpen)
}

export function saveSidebarOpen(open: boolean): void {
  writeFlag(STORAGE_KEYS.sidebar, open)
}

export function getPanelOpen(defaultOpen: boolean): boolean {
  return readFlag(STORAGE_KEYS.panel, defaultOpen)
}

export function savePanelOpen(open: boolean): void {
  writeFlag(STORAGE_KEYS.panel, open)
}
