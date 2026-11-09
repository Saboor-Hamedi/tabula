import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join, normalize, resolve } from 'node:path'
import { Readable } from 'node:stream'

/**
 * Minimal production server for Tabula.
 *
 * Serves the built app and proxies model requests so the DeepSeek credential
 * stays on the server. The browser talks to `/api/deepseek/v1/*`; this process
 * forwards the request and streams the response back unchanged.
 */

const PORT = Number(process.env.PORT ?? 8787)
const API_KEY = process.env.DEEPSEEK_API_KEY ?? ''
const UPSTREAM = 'https://api.deepseek.com'
const DIST = resolve('dist')
const MAX_BODY_BYTES = 2 * 1024 * 1024
const RATE_LIMIT = Number(process.env.RATE_LIMIT_PER_MINUTE ?? 30)

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

/** In-memory IP rate limiter. Good enough for a single Node instance. */
const hits = new Map()

function allowRequest(ip) {
  const now = Date.now()
  const windowStart = now - 60_000
  const recent = (hits.get(ip) ?? []).filter((time) => time > windowStart)
  if (recent.length >= RATE_LIMIT) {
    hits.set(ip, recent)
    return false
  }
  recent.push(now)
  hits.set(ip, recent)
  return true
}

function clientIp(request) {
  const forwarded = request.headers['x-forwarded-for']
  return typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : request.socket.remoteAddress
}

function sendJson(response, status, payload) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
  response.end(JSON.stringify(payload))
}

async function proxyModel(request, response) {
  if (!API_KEY) {
    sendJson(response, 503, { error: 'Model service is not configured.' })
    return
  }

  if (!allowRequest(clientIp(request))) {
    sendJson(response, 429, { error: 'Too many requests. Try again in a minute.' })
    return
  }

  const chunks = []
  let size = 0
  for await (const chunk of request) {
    size += chunk.length
    if (size > MAX_BODY_BYTES) {
      sendJson(response, 413, { error: 'Request is too large.' })
      return
    }
    chunks.push(chunk)
  }

  const targetPath = request.url.replace(/^\/api\/deepseek/, '') || '/v1'
  const target = `${UPSTREAM}${targetPath}`

  try {
    const upstream = await fetch(target, {
      method: request.method,
      headers: {
        authorization: `Bearer ${API_KEY}`,
        'content-type': request.headers['content-type'] ?? 'application/json',
        accept: request.headers.accept ?? 'text/event-stream',
      },
      body: Buffer.concat(chunks),
    })

    response.writeHead(upstream.status, {
      'content-type': upstream.headers.get('content-type') ?? 'text/event-stream',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
    })

    if (upstream.body) {
      Readable.fromWeb(upstream.body).pipe(response)
    } else {
      response.end()
    }
  } catch {
    sendJson(response, 502, { error: 'The model service is unavailable.' })
  }
}

function serveStatic(request, response) {
  const url = new URL(request.url, `http://${request.headers.host}`)
  const requested = normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, '')
  let filePath = join(DIST, requested)

  if (!filePath.startsWith(DIST)) {
    response.writeHead(403)
    response.end('Forbidden')
    return
  }

  if (!existsSync(filePath) || !statSync(filePath).isFile()) {
    filePath = join(DIST, 'index.html')
  }

  const type = MIME[extname(filePath).toLowerCase()] ?? 'application/octet-stream'
  response.writeHead(200, {
    'content-type': type,
    'cache-control': filePath.endsWith('index.html') || filePath.endsWith('sw.js') ? 'no-cache' : 'public, max-age=31536000, immutable',
  })
  createReadStream(filePath).pipe(response)
}

createServer((request, response) => {
  if (request.url === '/api/health') {
    sendJson(response, 200, { ok: true, modelConfigured: Boolean(API_KEY) })
    return
  }
  if (request.url?.startsWith('/api/deepseek')) {
    void proxyModel(request, response)
    return
  }
  serveStatic(request, response)
}).listen(PORT, () => {
  console.log(`Tabula server listening on http://localhost:${PORT}`)
})
