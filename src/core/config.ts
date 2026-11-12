/** Runtime configuration shared by the browser and the managed server proxy. */
export const API_MODE = 'proxy' as const

export const USES_SERVER_PROXY = true

/** The browser sends all model calls through the managed Tabula backend. */
export const PROXY_BASE_URL = '/api/deepseek/v1'

/** End users never supply provider API keys; AI access is managed by Tabula. */
export const NEEDS_ACCESS_KEY = false

export const TELEMETRY_ENDPOINT =
  typeof import.meta.env.VITE_TELEMETRY_ENDPOINT === 'string'
    ? import.meta.env.VITE_TELEMETRY_ENDPOINT
    : ''
