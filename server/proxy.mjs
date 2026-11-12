import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { PassThrough, Readable } from 'node:stream'

const UPSTREAM = 'https://api.deepseek.com'
const ALLOWED_DEEPSEEK_PATH = '/v1/chat/completions'
const ALLOWED_MODELS = new Set(['deepseek-v4-flash', 'deepseek-v4-pro'])
const MAX_BODY_BYTES = 2 * 1024 * 1024
const MAX_WEBHOOK_BYTES = 1 * 1024 * 1024
const MAX_COMPLETION_TOKENS = 8192
const MAX_CONCURRENT_STREAMS = 2
const KEY_CACHE_TTL_MS = 15_000
const TRIAL_DAYS = 7
const DAY_MS = 86_400_000

const CSP_POLICY = [
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
  "frame-ancestors 'none'",
].join('; ')

/** In-memory IP/user rate limiter and in-flight stream tracker for a single Node instance. */
const hits = new Map()
const activeStreams = new Map()
let lastHitsPrune = 0
let envLoaded = false
let cachedPlatformKey = { value: '', fetchedAt: 0 }

/**
 * Loads key=value pairs from `.env` and `.env.local` into `process.env`
 * without overriding already-set environment variables.
 */
export function ensureServerEnv(rootDir = process.cwd()) {
  if (envLoaded) return
  envLoaded = true

  for (const filename of ['.env', '.env.local']) {
    const filePath = resolve(rootDir, filename)
    if (!existsSync(filePath)) continue
    try {
      const content = readFileSync(filePath, 'utf8')
      for (const rawLine of content.split(/\r?\n/)) {
        const line = rawLine.trim()
        if (!line || line.startsWith('#')) continue
        const eq = line.indexOf('=')
        if (eq <= 0) continue
        const key = line.slice(0, eq).trim()
        let value = line.slice(eq + 1).trim()
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1)
        }
        if (!(key in process.env)) {
          process.env[key] = value
        }
      }
    } catch {
      // Ignore unreadable env files cleanly.
    }
  }
}

export function applySecurityHeaders(request, response) {
  response.setHeader('content-security-policy', CSP_POLICY)
  response.setHeader('x-content-type-options', 'nosniff')
  response.setHeader('x-frame-options', 'DENY')
  response.setHeader('referrer-policy', 'strict-origin-when-cross-origin')
  response.setHeader('permissions-policy', 'camera=(), microphone=(), geolocation=()')

  const isHttps =
    Boolean(request.socket?.encrypted) ||
    String(request.headers['x-forwarded-proto'] ?? '').split(',')[0].trim() === 'https'
  if (isHttps) {
    response.setHeader('strict-transport-security', 'max-age=31536000; includeSubDomains')
  }
}

function maskKey(key) {
  if (!key) return null
  if (key.length <= 10) return '••••••••'
  return `${key.slice(0, 5)}••••••••${key.slice(-4)}`
}

export function getServerConfig(rootDir = process.cwd()) {
  ensureServerEnv(rootDir)
  return {
    envKey: (process.env.DEEPSEEK_API_KEY ?? '').trim(),
    rateLimit: Number(process.env.RATE_LIMIT_PER_MINUTE ?? 30),
    freeMonthlyTokens: Number(process.env.MONTHLY_TOKENS_FREE ?? 250_000),
    proMonthlyTokens: Number(process.env.MONTHLY_TOKENS_PRO ?? 5_000_000),
    supabaseUrl: (process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? '')
      .trim()
      .replace(/\/+$/, ''),
    supabaseAnonKey: (process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY ?? '').trim(),
    supabaseServiceRoleKey: (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim(),
    encryptionSecret: (
      process.env.API_KEY_ENCRYPTION_SECRET ??
      process.env.SUPABASE_SERVICE_ROLE_KEY ??
      ''
    ).trim(),
    stripeSecretKey: (process.env.STRIPE_SECRET_KEY ?? '').trim(),
    stripePriceMonthly: (process.env.STRIPE_PRICE_ID_PRO_MONTHLY ?? '').trim(),
    stripeWebhookSecret: (process.env.STRIPE_WEBHOOK_SECRET ?? '').trim(),
    trustProxy: process.env.TRUST_PROXY === 'true',
  }
}

function supabaseAdminHeaders(config) {
  return {
    apikey: config.supabaseServiceRoleKey,
    authorization: `Bearer ${config.supabaseServiceRoleKey}`,
  }
}

function deriveEncryptionKey(secret) {
  return createHash('sha256').update(`tabula-api-key-v1:${secret}`).digest()
}

export function encryptApiKey(plaintext, config) {
  if (!config.encryptionSecret) return plaintext
  const key = deriveEncryptionKey(config.encryptionSecret)
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `enc:v1:${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`
}

export function decryptApiKey(stored, config) {
  const value = String(stored ?? '').trim()
  if (!value) return ''
  if (!value.startsWith('enc:v1:')) {
    // Support legacy plaintext rows transparently until rotated.
    return value
  }
  if (!config.encryptionSecret) return ''
  const parts = value.split(':')
  if (parts.length !== 5) return ''
  try {
    const iv = Buffer.from(parts[2], 'base64')
    const tag = Buffer.from(parts[3], 'base64')
    const ciphertext = Buffer.from(parts[4], 'base64')
    const decipher = createDecipheriv('aes-256-gcm', deriveEncryptionKey(config.encryptionSecret), iv)
    decipher.setAuthTag(tag)
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8').trim()
  } catch {
    return ''
  }
}

function sha256Hex(value) {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}

function invalidateKeyCache() {
  cachedPlatformKey = { value: '', fetchedAt: 0 }
}

function isValidDeepSeekKey(key) {
  return typeof key === 'string' && key.startsWith('sk-') && key.length >= 20 && !/\s/.test(key)
}

/**
 * Platform DeepSeek API key is managed via environment / Supabase Edge Function Secrets
 * (`DEEPSEEK_API_KEY`) and is never read from a database table.
 */
async function resolvePlatformApiKey(config) {
  return config.envKey
}

function getMonthStartIso() {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0)).toISOString()
}

function getMonthlyLimitForTier(tier, isAdmin, config) {
  if (isAdmin || tier === 'enterprise') return null
  if (tier === 'pro') return Number.isFinite(config.proMonthlyTokens) ? config.proMonthlyTokens : 5_000_000
  return Number.isFinite(config.freeMonthlyTokens) ? config.freeMonthlyTokens : 250_000
}

async function fetchMonthlyUsage(userId, config) {
  const zero = { inputTokens: 0, outputTokens: 0, totalTokens: 0, queryCount: 0 }
  if (!userId || !config.supabaseUrl || !config.supabaseServiceRoleKey) return zero
  const since = getMonthStartIso()

  try {
    const rpcRes = await fetch(`${config.supabaseUrl}/rest/v1/rpc/get_monthly_token_usage`, {
      method: 'POST',
      headers: {
        ...supabaseAdminHeaders(config),
        'content-type': 'application/json',
      },
      body: JSON.stringify({ p_user_id: userId, p_since: since }),
    })
    if (rpcRes.ok) {
      const rows = await rpcRes.json()
      const row = Array.isArray(rows) ? rows[0] : rows
      if (row) {
        const inputTokens = Number(row.input_tokens ?? 0)
        const outputTokens = Number(row.output_tokens ?? 0)
        const totalTokens = Number(row.total_tokens ?? inputTokens + outputTokens)
        const queryCount = Number(row.query_count ?? 0)
        return { inputTokens, outputTokens, totalTokens, queryCount }
      }
    }
  } catch {
    // Fall back to direct query if the RPC migration hasn't been applied yet.
  }

  try {
    const res = await fetch(
      `${config.supabaseUrl}/rest/v1/usage_ledger?user_id=eq.${encodeURIComponent(userId)}&created_at=gte.${encodeURIComponent(since)}&select=input_tokens,output_tokens,query_count&limit=10000`,
      { headers: supabaseAdminHeaders(config) },
    )
    if (!res.ok) return zero
    const rows = await res.json()
    if (!Array.isArray(rows)) return zero
    return rows.reduce(
      (acc, row) => {
        const inp = Number(row?.input_tokens ?? 0)
        const out = Number(row?.output_tokens ?? 0)
        const qc = Number(row?.query_count ?? 1)
        return {
          inputTokens: acc.inputTokens + inp,
          outputTokens: acc.outputTokens + out,
          totalTokens: acc.totalTokens + inp + out,
          queryCount: acc.queryCount + qc,
        }
      },
      zero,
    )
  } catch {
    return zero
  }
}

async function recordUsageLedger(userId, model, inputTokens, outputTokens, config) {
  if (!userId || !config.supabaseUrl || !config.supabaseServiceRoleKey) return
  try {
    await fetch(`${config.supabaseUrl}/rest/v1/usage_ledger`, {
      method: 'POST',
      headers: {
        ...supabaseAdminHeaders(config),
        'content-type': 'application/json',
        prefer: 'return=minimal',
      },
      body: JSON.stringify({
        user_id: userId,
        query_count: 1,
        input_tokens: Math.max(0, Math.round(inputTokens)),
        output_tokens: Math.max(0, Math.round(outputTokens)),
        model: String(model || 'deepseek-v4-flash'),
      }),
    })
  } catch {
    // Non-fatal telemetry write.
  }
}

function allowRequest(key, rateLimit) {
  const now = Date.now()
  const windowStart = now - 60_000

  if (now - lastHitsPrune > 300_000 || hits.size > 2000) {
    lastHitsPrune = now
    for (const [entryKey, times] of hits.entries()) {
      const fresh = times.filter((time) => time > windowStart)
      if (fresh.length === 0) hits.delete(entryKey)
      else hits.set(entryKey, fresh)
    }
  }

  const recent = (hits.get(key) ?? []).filter((time) => time > windowStart)
  if (recent.length >= rateLimit) {
    hits.set(key, recent)
    return false
  }
  recent.push(now)
  hits.set(key, recent)
  return true
}

function clientIp(request, config) {
  if (config.trustProxy) {
    const forwarded = request.headers['x-forwarded-for']
    if (typeof forwarded === 'string' && forwarded.trim().length > 0) {
      return forwarded.split(',')[0].trim()
    }
  }
  return request.socket?.remoteAddress || 'local'
}

export function sendJson(response, status, payload, request = null) {
  if (request) applySecurityHeaders(request, response)
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  })
  response.end(JSON.stringify(payload))
}

async function readBodyBuffer(request, maxBytes = MAX_BODY_BYTES) {
  const chunks = []
  let size = 0
  for await (const chunk of request) {
    size += chunk.length
    if (size > maxBytes) {
      return { tooLarge: true, buffer: Buffer.alloc(0) }
    }
    chunks.push(chunk)
  }
  return { tooLarge: false, buffer: Buffer.concat(chunks) }
}

export function computeEntitlement({ isAdmin, profile, subscription }) {
  const nowMs = Date.now()
  const tier = typeof subscription?.tier === 'string'
    ? subscription.tier
    : typeof profile?.tier === 'string'
      ? profile.tier
      : 'free'
  const status = typeof subscription?.status === 'string'
    ? subscription.status
    : 'trialing'

  const fallbackCreatedMs = profile?.created_at ? Date.parse(profile.created_at) : nowMs
  const defaultTrialEndIso = new Date(
    (Number.isFinite(fallbackCreatedMs) ? fallbackCreatedMs : nowMs) + TRIAL_DAYS * DAY_MS,
  ).toISOString()

  const trialEndsAt =
    subscription?.trial_ends_at ??
    (tier === 'free' ? (subscription?.current_period_end ?? defaultTrialEndIso) : null)
  const currentPeriodEnd = subscription?.current_period_end ?? trialEndsAt

  if (isAdmin) {
    return {
      tier,
      status,
      hasAccess: true,
      trialEndsAt,
      trialDaysRemaining: null,
      trialExpired: false,
      currentPeriodEnd,
      cancelAtPeriodEnd: Boolean(subscription?.cancel_at_period_end),
      stripeCustomerId: subscription?.stripe_customer_id ?? null,
    }
  }

  const periodEndMs = currentPeriodEnd ? Date.parse(currentPeriodEnd) : NaN
  const isPaidTier = tier === 'pro' || tier === 'enterprise'
  const isPaidActive =
    isPaidTier &&
    (status === 'active' || status === 'trialing') &&
    (!Number.isFinite(periodEndMs) || periodEndMs > nowMs)

  const trialEndMs = trialEndsAt ? Date.parse(trialEndsAt) : NaN
  const isTrialActive =
    !isPaidTier &&
    status === 'trialing' &&
    Number.isFinite(trialEndMs) &&
    trialEndMs > nowMs

  const hasAccess = isPaidActive || isTrialActive
  const trialExpired = !hasAccess
  const trialDaysRemaining = isTrialActive
    ? Math.max(1, Math.ceil((trialEndMs - nowMs) / DAY_MS))
    : 0

  return {
    tier,
    status: !isPaidActive && !isTrialActive && status === 'trialing' ? 'canceled' : status,
    hasAccess,
    trialEndsAt,
    trialDaysRemaining,
    trialExpired,
    currentPeriodEnd,
    cancelAtPeriodEnd: Boolean(subscription?.cancel_at_period_end),
    stripeCustomerId: subscription?.stripe_customer_id ?? null,
  }
}

async function verifyCaller(request, config) {
  if (!config.supabaseUrl || !config.supabaseAnonKey || !config.supabaseServiceRoleKey) {
    return {
      ok: false,
      status: 503,
      error: 'Authentication and billing configuration is incomplete on the server.',
    }
  }

  const authHeader =
    typeof request.headers.authorization === 'string' ? request.headers.authorization : ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : ''

  if (!token || token === 'tabula-managed' || token === 'server-proxy') {
    return { ok: false, status: 401, error: 'Sign in to use Tabula AI.' }
  }

  try {
    const authRes = await fetch(`${config.supabaseUrl}/auth/v1/user`, {
      headers: {
        apikey: config.supabaseAnonKey,
        authorization: `Bearer ${token}`,
      },
    })
    if (!authRes.ok) {
      return { ok: false, status: 401, error: 'Your session has expired. Please sign in again.' }
    }
    const user = await authRes.json()
    if (!user?.id) {
      return { ok: false, status: 401, error: 'Invalid account session.' }
    }
    if (user.email && !user.email_confirmed_at) {
      return { ok: false, status: 403, error: 'Please verify your email address before continuing.' }
    }

    const [profileRes, subRes] = await Promise.all([
      fetch(
        `${config.supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=role,tier,created_at,email&limit=1`,
        { headers: supabaseAdminHeaders(config) },
      ),
      fetch(
        `${config.supabaseUrl}/rest/v1/subscriptions?user_id=eq.${encodeURIComponent(user.id)}&select=tier,status,trial_ends_at,current_period_end,cancel_at_period_end,stripe_customer_id,stripe_subscription_id&order=created_at.desc&limit=1`,
        { headers: supabaseAdminHeaders(config) },
      ),
    ])

    const profileRows = profileRes.ok ? await profileRes.json() : []
    const profile = Array.isArray(profileRows) ? profileRows[0] ?? null : null
    const subRows = subRes.ok ? await subRes.json() : []
    const subscription = Array.isArray(subRows) ? subRows[0] ?? null : null

    const isAdmin = profile?.role === 'admin'
    const entitlement = computeEntitlement({ isAdmin, profile, subscription })

    return {
      ok: true,
      key: `user:${user.id}`,
      userId: user.id,
      email: user.email ?? profile?.email ?? null,
      isAdmin,
      ...entitlement,
    }
  } catch {
    return { ok: false, status: 502, error: 'Unable to verify account session.' }
  }
}

async function handleAdminKey(request, response, pathname, rootDir) {
  const config = getServerConfig(rootDir)
  const auth = await verifyCaller(request, config)
  if (!auth.ok) {
    sendJson(response, auth.status, { error: auth.error }, request)
    return
  }
  if (!auth.isAdmin) {
    sendJson(response, 403, { error: 'Only administrators can manage the platform API key.' }, request)
    return
  }

  if (pathname === '/api/admin/key/refresh' || request.method === 'GET') {
    const activeKey = await resolvePlatformApiKey(config)
    sendJson(
      response,
      200,
      {
        configured: Boolean(activeKey),
        masked: maskKey(activeKey),
      },
      request,
    )
    return
  }

  sendJson(
    response,
    410,
    { error: 'API keys are no longer stored in the database. Configure DEEPSEEK_API_KEY in Supabase Edge Function Secrets.' },
    request,
  )
}

async function handleUsageStatus(request, response, rootDir) {
  const config = getServerConfig(rootDir)
  const auth = await verifyCaller(request, config)
  if (!auth.ok) {
    sendJson(response, auth.status, { error: auth.error }, request)
    return
  }

  const monthlyLimit = getMonthlyLimitForTier(auth.tier, auth.isAdmin, config)
  const usage = await fetchMonthlyUsage(auth.userId, config)
  const remainingTokens =
    monthlyLimit === null ? null : Math.max(0, monthlyLimit - usage.totalTokens)

  sendJson(
    response,
    200,
    {
      tier: auth.tier,
      status: auth.status,
      isAdmin: auth.isAdmin,
      hasAccess: auth.hasAccess,
      trialEndsAt: auth.trialEndsAt,
      trialDaysRemaining: auth.trialDaysRemaining,
      trialExpired: auth.trialExpired,
      currentPeriodEnd: auth.currentPeriodEnd,
      cancelAtPeriodEnd: auth.cancelAtPeriodEnd,
      usedTokens: usage.totalTokens,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      queryCount: usage.queryCount,
      monthlyLimit,
      remainingTokens,
      periodStart: getMonthStartIso(),
      stripeConfigured: Boolean(
        config.stripeSecretKey && (config.stripePriceMonthly || config.stripePriceAnnual),
      ),
    },
    request,
  )
}

function resolveRequestOrigin(request, config) {
  const proto = config.trustProxy
    ? String(request.headers['x-forwarded-proto'] ?? '').split(',')[0].trim() || 'http'
    : request.socket?.encrypted
      ? 'https'
      : 'http'
  const host = String(request.headers.host ?? 'localhost:8787').trim()
  return `${proto}://${host}`
}

async function handleBillingCheckout(request, response, rootDir) {
  if (request.method !== 'POST') {
    sendJson(response, 405, { error: 'Method not allowed.' }, request)
    return
  }
  const config = getServerConfig(rootDir)
  const auth = await verifyCaller(request, config)
  if (!auth.ok) {
    sendJson(response, auth.status, { error: auth.error }, request)
    return
  }

  if (!config.stripeSecretKey) {
    sendJson(
      response,
      503,
      { error: 'Stripe billing is not configured yet. Set STRIPE_SECRET_KEY and Stripe Price IDs on the server.' },
      request,
    )
    return
  }

  const { tooLarge } = await readBodyBuffer(request, 16 * 1024)
  if (tooLarge) {
    sendJson(response, 413, { error: 'Payload too large.' }, request)
    return
  }

  const priceId = config.stripePriceMonthly

  if (!priceId) {
    sendJson(
      response,
      503,
      { error: 'Stripe pricing is not configured on the server (missing STRIPE_PRICE_ID_PRO_MONTHLY).' },
      request,
    )
    return
  }

  const origin = resolveRequestOrigin(request, config)
  const form = new URLSearchParams({
    mode: 'subscription',
    'line_items[0][price]': priceId,
    'line_items[0][quantity]': '1',
    client_reference_id: auth.userId,
    'metadata[user_id]': auth.userId,
    'subscription_data[metadata][user_id]': auth.userId,
    success_url: `${origin}/workspace?billing=success`,
    cancel_url: `${origin}/workspace?billing=canceled`,
  })
  if (auth.stripeCustomerId) {
    form.set('customer', auth.stripeCustomerId)
  } else if (auth.email) {
    form.set('customer_email', auth.email)
  }

  try {
    const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${config.stripeSecretKey}`,
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: form.toString(),
    })
    const payload = await stripeRes.json()
    if (!stripeRes.ok || !payload?.url) {
      sendJson(
        response,
        502,
        { error: payload?.error?.message ?? 'Could not create Stripe checkout session.' },
        request,
      )
      return
    }
    sendJson(response, 200, { url: payload.url }, request)
  } catch {
    sendJson(response, 502, { error: 'Unable to reach Stripe Checkout.' }, request)
  }
}

async function handleBillingPortal(request, response, rootDir) {
  if (request.method !== 'POST') {
    sendJson(response, 405, { error: 'Method not allowed.' }, request)
    return
  }
  const config = getServerConfig(rootDir)
  const auth = await verifyCaller(request, config)
  if (!auth.ok) {
    sendJson(response, auth.status, { error: auth.error }, request)
    return
  }
  if (!config.stripeSecretKey || !auth.stripeCustomerId) {
    sendJson(response, 400, { error: 'No active Stripe customer record found for this account.' }, request)
    return
  }

  const origin = resolveRequestOrigin(request, config)
  const form = new URLSearchParams({
    customer: auth.stripeCustomerId,
    return_url: `${origin}/workspace`,
  })

  try {
    const stripeRes = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${config.stripeSecretKey}`,
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: form.toString(),
    })
    const payload = await stripeRes.json()
    if (!stripeRes.ok || !payload?.url) {
      sendJson(response, 502, { error: 'Could not open Stripe billing portal.' }, request)
      return
    }
    sendJson(response, 200, { url: payload.url }, request)
  } catch {
    sendJson(response, 502, { error: 'Unable to reach Stripe billing portal.' }, request)
  }
}

export function verifyStripeSignature(rawBody, sigHeader, secret) {
  if (!sigHeader || !secret) return false
  const parts = String(sigHeader).split(',')
  let timestamp = ''
  const signatures = []
  for (const part of parts) {
    const [k, v] = part.split('=')
    if (k === 't') timestamp = v
    else if (k === 'v1' && v) signatures.push(v)
  }
  if (!timestamp || signatures.length === 0) return false
  const ageSeconds = Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp))
  if (!Number.isFinite(ageSeconds) || ageSeconds > 300) return false

  const expected = createHmac('sha256', secret)
    .update(`${timestamp}.${rawBody.toString('utf8')}`)
    .digest('hex')
  const expectedBuf = Buffer.from(expected, 'hex')

  return signatures.some((sig) => {
    try {
      const actualBuf = Buffer.from(sig, 'hex')
      return actualBuf.length === expectedBuf.length && timingSafeEqual(actualBuf, expectedBuf)
    } catch {
      return false
    }
  })
}

async function syncSubscriptionFromStripe({
  config,
  userId,
  customerId,
  subscriptionId,
  status,
  tier,
  priceId,
  periodStart,
  periodEnd,
  cancelAtPeriodEnd,
}) {
  if (!config.supabaseUrl || !config.supabaseServiceRoleKey) return
  const filter = userId
    ? `user_id=eq.${encodeURIComponent(userId)}`
    : customerId
      ? `stripe_customer_id=eq.${encodeURIComponent(customerId)}`
      : null
  if (!filter) return

  const updateBody = {
    tier,
    status,
    cancel_at_period_end: Boolean(cancelAtPeriodEnd),
  }
  if (customerId) updateBody.stripe_customer_id = customerId
  if (subscriptionId) updateBody.stripe_subscription_id = subscriptionId
  if (priceId) updateBody.price_id = priceId
  if (periodStart) updateBody.current_period_start = new Date(periodStart * 1000).toISOString()
  if (periodEnd) updateBody.current_period_end = new Date(periodEnd * 1000).toISOString()

  await fetch(`${config.supabaseUrl}/rest/v1/subscriptions?${filter}`, {
    method: 'PATCH',
    headers: {
      ...supabaseAdminHeaders(config),
      'content-type': 'application/json',
      prefer: 'return=minimal',
    },
    body: JSON.stringify(updateBody),
  })

  if (userId) {
    await fetch(`${config.supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}`, {
      method: 'PATCH',
      headers: {
        ...supabaseAdminHeaders(config),
        'content-type': 'application/json',
        prefer: 'return=minimal',
      },
      body: JSON.stringify({ tier }),
    })
  } else if (customerId) {
    const subLookup = await fetch(
      `${config.supabaseUrl}/rest/v1/subscriptions?stripe_customer_id=eq.${encodeURIComponent(customerId)}&select=user_id&limit=1`,
      { headers: supabaseAdminHeaders(config) },
    )
    const rows = subLookup.ok ? await subLookup.json() : []
    const resolvedUserId = rows?.[0]?.user_id
    if (resolvedUserId) {
      await fetch(`${config.supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(resolvedUserId)}`, {
        method: 'PATCH',
        headers: {
          ...supabaseAdminHeaders(config),
          'content-type': 'application/json',
          prefer: 'return=minimal',
        },
        body: JSON.stringify({ tier }),
      })
    }
  }
}

async function handleStripeWebhook(request, response, rootDir) {
  if (request.method !== 'POST') {
    sendJson(response, 405, { error: 'Method not allowed.' }, request)
    return
  }
  const config = getServerConfig(rootDir)
  if (!config.stripeWebhookSecret) {
    sendJson(response, 503, { error: 'Stripe webhook secret not configured.' }, request)
    return
  }

  const { tooLarge, buffer } = await readBodyBuffer(request, MAX_WEBHOOK_BYTES)
  if (tooLarge) {
    sendJson(response, 413, { error: 'Webhook payload too large.' }, request)
    return
  }

  const sig = request.headers['stripe-signature']
  if (!verifyStripeSignature(buffer, sig, config.stripeWebhookSecret)) {
    sendJson(response, 400, { error: 'Invalid Stripe signature.' }, request)
    return
  }

  let event = null
  try {
    event = JSON.parse(buffer.toString('utf8'))
  } catch {
    sendJson(response, 400, { error: 'Invalid webhook JSON.' }, request)
    return
  }

  const obj = event?.data?.object
  try {
    if (event?.type === 'checkout.session.completed' && obj) {
      const userId = obj.client_reference_id || obj.metadata?.user_id || null
      const customerId = typeof obj.customer === 'string' ? obj.customer : null
      const subscriptionId = typeof obj.subscription === 'string' ? obj.subscription : null

      let periodStart = null
      let periodEnd = null
      let priceId = null
      let status = 'active'

      if (subscriptionId && config.stripeSecretKey) {
        const subRes = await fetch(
          `https://api.stripe.com/v1/subscriptions/${encodeURIComponent(subscriptionId)}`,
          { headers: { authorization: `Bearer ${config.stripeSecretKey}` } },
        )
        if (subRes.ok) {
          const sub = await subRes.json()
          status = sub.status || 'active'
          periodStart = sub.current_period_start ?? null
          periodEnd = sub.current_period_end ?? null
          priceId = sub.items?.data?.[0]?.price?.id ?? null
        }
      }

      await syncSubscriptionFromStripe({
        config,
        userId,
        customerId,
        subscriptionId,
        status,
        tier: 'pro',
        priceId,
        periodStart,
        periodEnd,
        cancelAtPeriodEnd: false,
      })
    } else if (
      (event?.type === 'customer.subscription.created' ||
        event?.type === 'customer.subscription.updated' ||
        event?.type === 'customer.subscription.deleted') &&
      obj
    ) {
      const status = obj.status || (event.type === 'customer.subscription.deleted' ? 'canceled' : 'active')
      const activePaid = status === 'active' || status === 'trialing'
      await syncSubscriptionFromStripe({
        config,
        userId: obj.metadata?.user_id ?? null,
        customerId: typeof obj.customer === 'string' ? obj.customer : null,
        subscriptionId: obj.id ?? null,
        status,
        tier: activePaid ? 'pro' : 'free',
        priceId: obj.items?.data?.[0]?.price?.id ?? null,
        periodStart: obj.current_period_start ?? null,
        periodEnd: obj.current_period_end ?? null,
        cancelAtPeriodEnd: Boolean(obj.cancel_at_period_end),
      })
    }
  } catch {
    sendJson(response, 500, { error: 'Failed to process Stripe webhook.' }, request)
    return
  }

  sendJson(response, 200, { received: true }, request)
}

function parseUsageFromText(rawText) {
  let inputTokens = 0
  let outputTokens = 0

  for (const line of rawText.split('\n')) {
    const trimmed = line.trim()
    const payload = trimmed.startsWith('data:') ? trimmed.slice(5).trim() : trimmed
    if (!payload || payload === '[DONE]' || payload[0] !== '{') continue
    try {
      const parsed = JSON.parse(payload)
      const usage = parsed?.usage
      if (usage && (typeof usage.prompt_tokens === 'number' || typeof usage.completion_tokens === 'number')) {
        inputTokens = Number(usage.prompt_tokens ?? inputTokens)
        outputTokens = Number(usage.completion_tokens ?? outputTokens)
      }
    } catch {
      // Partial chunk line ignored safely.
    }
  }

  return { inputTokens, outputTokens }
}

async function proxyDeepSeek(request, response, pathname, rootDir) {
  const config = getServerConfig(rootDir)

  if (request.method !== 'POST') {
    sendJson(response, 405, { error: 'Method not allowed.' }, request)
    return
  }

  const subPath = pathname.replace(/^\/api\/deepseek/, '')
  if (subPath !== ALLOWED_DEEPSEEK_PATH || (request.url ?? '').includes('?')) {
    sendJson(response, 404, { error: 'Unsupported AI endpoint.' }, request)
    return
  }

  const auth = await verifyCaller(request, config)
  if (!auth.ok) {
    sendJson(response, auth.status, { error: auth.error }, request)
    return
  }

  if (!auth.hasAccess) {
    sendJson(
      response,
      402,
      {
        error: 'Your 7-day free trial has ended. Subscribe to Tabula Pro to continue analysing data.',
        code: 'TRIAL_EXPIRED',
      },
      request,
    )
    return
  }

  const effectiveKey = await resolvePlatformApiKey(config)
  if (!effectiveKey) {
    sendJson(
      response,
      503,
      { error: 'Tabula AI service is not configured yet. Please ask your administrator to add the API key.' },
      request,
    )
    return
  }

  if (!allowRequest(auth.key, config.rateLimit) || !allowRequest(`ip:${clientIp(request, config)}`, config.rateLimit * 2)) {
    sendJson(response, 429, { error: 'Too many requests. Please wait a minute and try again.' }, request)
    return
  }

  const currentStreams = activeStreams.get(auth.key) ?? 0
  if (currentStreams >= MAX_CONCURRENT_STREAMS) {
    sendJson(
      response,
      429,
      { error: 'Too many concurrent AI requests. Wait for the current answer to finish.' },
      request,
    )
    return
  }

  const monthlyLimit = getMonthlyLimitForTier(auth.tier, auth.isAdmin, config)
  if (auth.userId && monthlyLimit !== null) {
    const usage = await fetchMonthlyUsage(auth.userId, config)
    if (usage.totalTokens >= monthlyLimit) {
      sendJson(
        response,
        402,
        {
          error: `You have finished your ${auth.tier === 'free' ? 'trial' : 'monthly'} tokens (${usage.totalTokens.toLocaleString()} / ${monthlyLimit.toLocaleString()} tokens).`,
          code: 'QUOTA_EXCEEDED',
        },
        request,
      )
      return
    }
  }

  const { tooLarge, buffer } = await readBodyBuffer(request)
  if (tooLarge) {
    sendJson(response, 413, { error: 'Request is too large.' }, request)
    return
  }

  let parsed
  try {
    parsed = JSON.parse(buffer.toString('utf8'))
  } catch {
    sendJson(response, 400, { error: 'Invalid JSON request body.' }, request)
    return
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    sendJson(response, 400, { error: 'Invalid request body.' }, request)
    return
  }

  const requestModel = typeof parsed.model === 'string' ? parsed.model : 'deepseek-v4-flash'
  if (!ALLOWED_MODELS.has(requestModel)) {
    sendJson(response, 400, { error: `Unsupported model "${requestModel}".` }, request)
    return
  }

  if (typeof parsed.max_tokens === 'number' && parsed.max_tokens > MAX_COMPLETION_TOKENS) {
    parsed.max_tokens = MAX_COMPLETION_TOKENS
  }
  if (typeof parsed.max_completion_tokens === 'number' && parsed.max_completion_tokens > MAX_COMPLETION_TOKENS) {
    parsed.max_completion_tokens = MAX_COMPLETION_TOKENS
  }
  if (parsed.stream === true) {
    parsed.stream_options = { include_usage: true }
  }

  const outgoingBody = Buffer.from(JSON.stringify(parsed), 'utf8')
  const approxInputTokens = Math.max(1, Math.round(buffer.length / 4))
  const target = `${UPSTREAM}${ALLOWED_DEEPSEEK_PATH}`

  activeStreams.set(auth.key, currentStreams + 1)
  let released = false
  const releaseStream = () => {
    if (released) return
    released = true
    const count = activeStreams.get(auth.key) ?? 1
    if (count <= 1) activeStreams.delete(auth.key)
    else activeStreams.set(auth.key, count - 1)
  }

  try {
    const upstream = await fetch(target, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${effectiveKey}`,
        'content-type': 'application/json',
        accept: request.headers.accept ?? 'text/event-stream',
      },
      body: outgoingBody,
    })

    applySecurityHeaders(request, response)
    response.writeHead(upstream.status, {
      'content-type': upstream.headers.get('content-type') ?? 'text/event-stream',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
    })

    if (!upstream.body) {
      releaseStream()
      response.end()
      return
    }

    if (!auth.userId || !upstream.ok) {
      const upstreamStream = Readable.fromWeb(upstream.body)
      upstreamStream.on('end', releaseStream)
      upstreamStream.on('error', releaseStream)
      response.on('close', releaseStream)
      upstreamStream.pipe(response)
      return
    }

    // Passively tap streamed bytes so we can log token usage in `usage_ledger`
    // without delaying or modifying the SSE stream.
    const tap = new PassThrough()
    let captured = ''
    let capturedBytes = 0

    tap.on('data', (chunk) => {
      capturedBytes += chunk.length
      if (captured.length < 256_000) {
        captured += chunk.toString('utf8')
      }
    })

    tap.on('end', () => {
      releaseStream()
      const parsedUsage = parseUsageFromText(captured)
      const inTokens = parsedUsage.inputTokens > 0 ? parsedUsage.inputTokens : approxInputTokens
      const outTokens =
        parsedUsage.outputTokens > 0
          ? parsedUsage.outputTokens
          : Math.max(1, Math.round(capturedBytes / 8))
      void recordUsageLedger(auth.userId, requestModel, inTokens, outTokens, config)
    })

    tap.on('error', releaseStream)
    response.on('close', releaseStream)

    const upstreamStream = Readable.fromWeb(upstream.body)
    upstreamStream.on('error', releaseStream)
    upstreamStream.pipe(tap)
    upstreamStream.pipe(response)
  } catch {
    releaseStream()
    if (!response.headersSent) {
      sendJson(response, 502, { error: 'The Tabula AI service is temporarily unavailable.' }, request)
    } else {
      response.end()
    }
  }
}

export function isSameOriginRequest(request) {
  const origin = request.headers.origin
  if (!origin) return true
  const host = request.headers.host
  if (!host) return false
  try {
    return new URL(origin).host === host
  } catch {
    return false
  }
}

/**
 * Handles `/api/health`, `/api/usage`, `/api/admin/key*`, `/api/billing/*`, and
 * `/api/deepseek/*` requests in both Node production and Vite dev middleware.
 */
export function handleApiRequest(request, response, rootDir = process.cwd()) {
  const pathname = (request.url ?? '').split('?')[0]
  if (!pathname.startsWith('/api/')) return false

  if (pathname === '/api/billing/webhook') {
    void handleStripeWebhook(request, response, rootDir)
    return true
  }

  if (!isSameOriginRequest(request)) {
    sendJson(response, 403, { error: 'Cross-origin API requests are forbidden.' }, request)
    return true
  }

  if (pathname === '/api/health') {
    void (async () => {
      const config = getServerConfig(rootDir)
      const key = await resolvePlatformApiKey(config)
      sendJson(response, 200, { ok: true, modelConfigured: Boolean(key) }, request)
    })()
    return true
  }
  if (pathname === '/api/usage') {
    void handleUsageStatus(request, response, rootDir)
    return true
  }
  if (pathname === '/api/admin/key' || pathname === '/api/admin/key/refresh') {
    void handleAdminKey(request, response, pathname, rootDir)
    return true
  }
  if (pathname === '/api/billing/checkout') {
    void handleBillingCheckout(request, response, rootDir)
    return true
  }
  if (pathname === '/api/billing/portal') {
    void handleBillingPortal(request, response, rootDir)
    return true
  }
  if (pathname.startsWith('/api/deepseek')) {
    void proxyDeepSeek(request, response, pathname, rootDir)
    return true
  }

  sendJson(response, 404, { error: 'Not found.' }, request)
  return true
}
