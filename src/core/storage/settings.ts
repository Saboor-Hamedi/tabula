import type { ModelId } from '../types'
import { STORAGE_KEYS } from '../constants'
import { resolveModelId } from '../agent/modelOptions'

function getStorage(): Storage | null {
  try {
    if (typeof window === 'undefined') return null
    const storage = window.localStorage
    const probe = '__tabula_probe__'
    storage.setItem(probe, '1')
    storage.removeItem(probe)
    return storage
  } catch {
    return null
  }
}

export function getStoredModel(): ModelId {
  const storage = getStorage()
  if (!storage) return resolveModelId(null)
  return resolveModelId(storage.getItem(STORAGE_KEYS.model))
}

export function saveModel(model: ModelId): void {
  const storage = getStorage()
  if (!storage) return
  storage.setItem(STORAGE_KEYS.model, model)
}

export function getTelemetryEnabled(): boolean {
  const storage = getStorage()
  return storage?.getItem(STORAGE_KEYS.telemetry) === '1'
}

export function saveTelemetryEnabled(enabled: boolean): void {
  const storage = getStorage()
  if (!storage) return
  storage.setItem(STORAGE_KEYS.telemetry, enabled ? '1' : '0')
}
