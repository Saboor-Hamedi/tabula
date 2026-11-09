/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_MODE?: 'local' | 'proxy'
  readonly VITE_TELEMETRY_ENDPOINT?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
