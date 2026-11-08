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

export const SIDEBAR_WIDTH = { min: 200, max: 420, default: 268 } as const
export const PANEL_WIDTH = { min: 240, max: 520, default: 320 } as const

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)))
}

function readWidth(key: string, fallback: number, min: number, max: number): number {
  try {
    const raw = window.localStorage.getItem(key)
    if (raw === null) return fallback
    const parsed = Number(raw)
    return Number.isFinite(parsed) ? clamp(parsed, min, max) : fallback
  } catch {
    return fallback
  }
}

function writeWidth(key: string, value: number): void {
  try {
    window.localStorage.setItem(key, String(Math.round(value)))
  } catch {
    // Layout preferences are optional.
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

export function getSidebarWidth(): number {
  return readWidth(
    STORAGE_KEYS.sidebarWidth,
    SIDEBAR_WIDTH.default,
    SIDEBAR_WIDTH.min,
    SIDEBAR_WIDTH.max,
  )
}

export function saveSidebarWidth(width: number): void {
  writeWidth(STORAGE_KEYS.sidebarWidth, clamp(width, SIDEBAR_WIDTH.min, SIDEBAR_WIDTH.max))
}

export function getPanelWidth(): number {
  return readWidth(
    STORAGE_KEYS.panelWidth,
    PANEL_WIDTH.default,
    PANEL_WIDTH.min,
    PANEL_WIDTH.max,
  )
}

export function savePanelWidth(width: number): void {
  writeWidth(STORAGE_KEYS.panelWidth, clamp(width, PANEL_WIDTH.min, PANEL_WIDTH.max))
}
