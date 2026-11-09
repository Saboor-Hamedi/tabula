/** Runtime configuration shared by the browser and the optional proxy server. */
export const API_MODE: 'local' | 'proxy' =
  import.meta.env.VITE_API_MODE === 'proxy' ? 'proxy' : 'local'

export const USES_SERVER_PROXY = API_MODE === 'proxy'

/** The browser sends model calls here when a server proxy is configured. */
export const PROXY_BASE_URL = '/api/deepseek/v1'

/** A key is not required when the server owns the credential. */
export const NEEDS_ACCESS_KEY = !USES_SERVER_PROXY

export const TELEMETRY_ENDPOINT =
  typeof import.meta.env.VITE_TELEMETRY_ENDPOINT === 'string'
    ? import.meta.env.VITE_TELEMETRY_ENDPOINT
    : ''
