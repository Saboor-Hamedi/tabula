import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

const CSP = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval' blob:",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' https://api.deepseek.com https://*.deepseek.com blob:",
  "worker-src 'self' blob:",
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

export default defineConfig({
  plugins: [react(), productionCsp()],
})
