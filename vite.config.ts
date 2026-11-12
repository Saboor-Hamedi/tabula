import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import { handleApiRequest } from './server/proxy.mjs'

const CSP = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval' blob: https://cdn.jsdelivr.net",
  "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co https://cdn.jsdelivr.net blob: data:",
  "worker-src 'self' blob: https://cdn.jsdelivr.net",
  "child-src 'self' blob:",
  "frame-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ')

/** Production-only security headers without breaking Vite's dev websocket. */
function productionCsp(): Plugin {
  return {
    name: 'tabula-production-csp',
    apply: 'build',
    transformIndexHtml(html) {
      return html.replace(
        '</head>',
        `    <meta http-equiv="Content-Security-Policy" content="${CSP}" />\n  </head>`,
      )
    },
  }
}

/** Handles `/api/*` directly inside Vite dev so managed AI works without a second terminal. */
function managedAiDevProxy(): Plugin {
  return {
    name: 'tabula-managed-ai-proxy',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        if (handleApiRequest(request, response)) return
        next()
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), productionCsp(), managedAiDevProxy()],
})
