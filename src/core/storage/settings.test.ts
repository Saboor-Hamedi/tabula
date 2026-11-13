import { beforeEach, describe, expect, it, vi } from 'vitest'

function installWindow() {
  const store = new Map<string, string>()
  const localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, String(value)),
    removeItem: (key: string) => void store.delete(key),
    clear: () => store.clear(),
    get length() {
      return store.size
    },
    key: (index: number) => Array.from(store.keys())[index] ?? null,
  }
  vi.stubGlobal('window', { localStorage })
  return { store, localStorage }
}

async function loadSettings() {
  vi.resetModules()
  return import('./settings')
}

describe('storage settings', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it('falls back to the default model when storage is unavailable', async () => {
    vi.stubGlobal('window', undefined)
    const { getStoredModel } = await loadSettings()
    expect(getStoredModel()).toBe('deepseek-v4-flash')
  })

  it('round-trips the selected model', async () => {
    installWindow()
    const { getStoredModel, saveModel } = await loadSettings()
    expect(getStoredModel()).toBe('deepseek-v4-flash')
    saveModel('deepseek-v4-pro')
    expect(getStoredModel()).toBe('deepseek-v4-pro')
  })

  it('resolves garbage in storage to the default model', async () => {
    const { store } = installWindow()
    store.set('data-agent:model', 'not-a-real-model')
    const { getStoredModel } = await loadSettings()
    expect(getStoredModel()).toBe('deepseek-v4-flash')
  })

  it('toggles telemetry flag as a 1/0 string', async () => {
    installWindow()
    const { getTelemetryEnabled, saveTelemetryEnabled } = await loadSettings()
    expect(getTelemetryEnabled()).toBe(false)
    saveTelemetryEnabled(true)
    expect(getTelemetryEnabled()).toBe(true)
    saveTelemetryEnabled(false)
    expect(getTelemetryEnabled()).toBe(false)
  })

  it('treats any value other than 1 as disabled for telemetry', async () => {
    const { store } = installWindow()
    store.set('data-agent:ui:telemetry', 'yes')
    const { getTelemetryEnabled } = await loadSettings()
    expect(getTelemetryEnabled()).toBe(false)
  })
})
