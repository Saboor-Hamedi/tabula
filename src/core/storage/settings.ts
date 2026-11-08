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

export function getStoredApiKey(): string | null {
  const storage = getStorage()
  if (!storage) return null
  const value = storage.getItem(STORAGE_KEYS.apiKey)
  const trimmed = value?.trim() ?? ''
  return trimmed.length > 0 ? trimmed : null
}

export function saveApiKey(key: string): void {
  const storage = getStorage()
  if (!storage) return
  const trimmed = key.trim()
  if (trimmed.length === 0) {
    storage.removeItem(STORAGE_KEYS.apiKey)
    return
  }
  storage.setItem(STORAGE_KEYS.apiKey, trimmed)
}

export function clearApiKey(): void {
  const storage = getStorage()
  if (!storage) return
  storage.removeItem(STORAGE_KEYS.apiKey)
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

export interface ApiKeyValidation {
  valid: boolean
  message: string | null
}

export function validateApiKey(key: string): ApiKeyValidation {
  const trimmed = key.trim()
  if (trimmed.length === 0) {
    return { valid: false, message: 'Enter your DeepSeek API key to continue.' }
  }
  if (!trimmed.startsWith('sk-')) {
    return { valid: false, message: 'DeepSeek keys usually start with "sk-".' }
  }
  if (trimmed.length < 20) {
    return { valid: false, message: 'That key looks too short. Paste the full key.' }
  }
  if (/\s/.test(trimmed)) {
    return { valid: false, message: 'The key should not contain spaces or line breaks.' }
  }
  return { valid: true, message: null }
}

export function maskApiKey(key: string): string {
  if (key.length <= 10) return '••••••••'
  return `${key.slice(0, 5)}••••••••${key.slice(-4)}`
}
