import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join, normalize, resolve, sep } from 'node:path'
import { applySecurityHeaders, ensureServerEnv, handleApiRequest } from './proxy.mjs'

/**
 * Production server for Tabula.
 *
 * Serves the built app with strict HTTP security headers and proxies managed
 * AI and billing requests so model and billing credentials stay on the server.
 */

ensureServerEnv(process.cwd())

const PORT = Number(process.env.PORT ?? 8787)
const DIST = resolve('dist')

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.wasm': 'application/wasm',
  '.csv': 'text/csv; charset=utf-8',
}

function serveStatic(request, response) {
  applySecurityHeaders(request, response)

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { 'content-type': 'text/plain; charset=utf-8' })
    response.end('Method Not Allowed')
    return
  }

  let pathname
  try {
    const url = new URL(request.url ?? '/', 'http://localhost')
    pathname = decodeURIComponent(url.pathname)
  } catch {
    response.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' })
    response.end('Bad Request')
    return
  }

  const requested = normalize(pathname).replace(/^([/\\])+/, '')
  let filePath = resolve(join(DIST, requested))

  if (filePath !== DIST && !filePath.startsWith(DIST + sep)) {
    response.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' })
    response.end('Forbidden')
    return
  }

  if (!existsSync(filePath) || !statSync(filePath).isFile()) {
    filePath = join(DIST, 'index.html')
  }

  const type = MIME[extname(filePath).toLowerCase()] ?? 'application/octet-stream'
  response.writeHead(200, {
    'content-type': type,
    'cache-control':
      filePath.endsWith('index.html') || filePath.endsWith('sw.js')
        ? 'no-cache'
        : 'public, max-age=31536000, immutable',
  })

  if (request.method === 'HEAD') {
    response.end()
    return
  }
  createReadStream(filePath).pipe(response)
}

const server = createServer((request, response) => {
  if (handleApiRequest(request, response)) return
  serveStatic(request, response)
})

server.requestTimeout = 120_000
server.headersTimeout = 15_000

server.listen(PORT, () => {
  console.log(`Tabula server listening on http://localhost:${PORT}`)
})
