import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

function getCorsHeaders(req: Request): Record<string, string> {
  const requestedHeaders = req.headers.get('Access-Control-Request-Headers')
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers':
      requestedHeaders ||
      'authorization, x-client-info, apikey, content-type, user-agent, x-tabula-guest-id',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
  }
}

const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions'
const ALLOWED_MODELS = new Set([
  'deepseek-v4-flash',
  'deepseek-v4-pro',
  'deepseek-chat',
  'deepseek-reasoner',
])
const GUEST_ALLOWED_MODELS = new Set(['deepseek-v4-flash', 'deepseek-chat'])
const GUEST_ID_TOKEN_LIMIT = 20_000
const GUEST_IP_DAILY_TOKEN_LIMIT = 25_000
const GUEST_WINDOW_MS = 24 * 60 * 60 * 1000
const MAX_USER_PROMPT_WORDS = 300
const MAX_USER_PROMPT_CHARS = 3000
const UNSAFE_PROMPT_RE =
  /(?:javascript:|vbscript:|file:\/\/|data:text\/html|<\s*\/?\s*(?:script|iframe|object|embed|svg|link|meta)\b|on(?:error|load|click|mouseover|focus)\s*=|\beval\s*\(|document\.cookie|window\.location|https?:\/\/[^\s]+|\bwww\.[a-z0-9-]+(?:\.[a-z0-9-]+)+|\b(?:127\.0\.0\.1|169\.254\.169\.254|0\.0\.0\.0|localhost)(?::\d+)?)/i

function extractLastUserText(messages: unknown): string {
  if (!Array.isArray(messages)) return ''
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const msg = messages[i] as { role?: unknown; content?: unknown } | null
    if (msg?.role !== 'user') continue
    if (typeof msg.content === 'string') return msg.content
    if (Array.isArray(msg.content)) {
      return msg.content
        .map((part) => (part && typeof part === 'object' && 'text' in part ? String((part as { text?: unknown }).text ?? '') : ''))
        .join(' ')
    }
  }
  return ''
}

function getClientIp(req: Request): string {
  const cfIp = req.headers.get('cf-connecting-ip')?.trim()
  if (cfIp) return cfIp
  const realIp = req.headers.get('x-real-ip')?.trim()
  if (realIp) return realIp
  const xff = req.headers.get('x-forwarded-for')
  if (xff) {
    const first = xff.split(',')[0]?.trim()
    if (first) return first
  }
  return 'unknown'
}

async function hashClientIp(ip: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${ip}|${salt}`)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function jsonResponse(req: Request, body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...getCorsHeaders(req),
      'Content-Type': 'application/json',
    },
  })
}

function extractTotalTokens(usage: unknown): number {
  if (!usage || typeof usage !== 'object') return 0
  const candidate = usage as {
    total_tokens?: unknown
    prompt_tokens?: unknown
    completion_tokens?: unknown
    prompt_cache_hit_tokens?: unknown
    prompt_cache_miss_tokens?: unknown
    prompt_tokens_details?: { cached_tokens?: unknown }
  }

  const completion =
    typeof candidate.completion_tokens === 'number' && Number.isFinite(candidate.completion_tokens)
      ? Math.max(0, candidate.completion_tokens)
      : 0

  const cacheHit =
    typeof candidate.prompt_cache_hit_tokens === 'number' &&
    Number.isFinite(candidate.prompt_cache_hit_tokens)
      ? Math.max(0, candidate.prompt_cache_hit_tokens)
      : typeof candidate.prompt_tokens_details?.cached_tokens === 'number' &&
          Number.isFinite(candidate.prompt_tokens_details.cached_tokens)
        ? Math.max(0, candidate.prompt_tokens_details.cached_tokens)
        : 0

  const cacheMiss =
    typeof candidate.prompt_cache_miss_tokens === 'number' &&
    Number.isFinite(candidate.prompt_cache_miss_tokens)
      ? Math.max(0, candidate.prompt_cache_miss_tokens)
      : typeof candidate.prompt_tokens === 'number' && Number.isFinite(candidate.prompt_tokens)
        ? Math.max(0, candidate.prompt_tokens - cacheHit)
        : 0

  if (cacheHit > 0 || cacheMiss > 0 || completion > 0) {
    // DeepSeek bills cache-hit input tokens at 10% of normal input cost.
    return Math.max(0, Math.round(cacheHit * 0.1) + Math.round(cacheMiss) + Math.round(completion))
  }

  if (typeof candidate.total_tokens === 'number' && Number.isFinite(candidate.total_tokens)) {
    return Math.max(0, Math.round(candidate.total_tokens))
  }
  return 0
}

function parseSseUsageChunk(line: string): number {
  const trimmed = line.trim()
  const payload = trimmed.startsWith('data:') ? trimmed.slice(5).trim() : trimmed
  if (!payload || payload === '[DONE]' || payload[0] !== '{') return 0
  try {
    const parsed = JSON.parse(payload) as { usage?: unknown }
    return extractTotalTokens(parsed?.usage)
  } catch {
    return 0
  }
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: getCorsHeaders(req) })
  }

  if (req.method !== 'POST') {
    return jsonResponse(req, { error: 'Method not allowed.' }, 405)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const deepseekApiKey = Deno.env.get('DEEPSEEK_API_KEY')

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return jsonResponse(req, { error: 'Supabase environment variables are not configured.' }, 500)
  }

  if (!deepseekApiKey) {
    return jsonResponse(req, { error: 'DEEPSEEK_API_KEY secret is not configured.' }, 503)
  }

  const authHeader = req.headers.get('Authorization') ?? ''
  const guestHeader = (req.headers.get('x-tabula-guest-id') ?? '').trim()
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  let userId: string | null = null
  let guestId: string | null = null
  let guestIpHash: string | null = null
  let guestIpRemaining = GUEST_IP_DAILY_TOKEN_LIMIT
  let isGuest = false
  let isAdminUser = false
  let tokensRemaining = 0

  if (authHeader.startsWith('Bearer ')) {
    // 1a. Verify signed-in user JWT.
    const supabaseUserClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const {
      data: { user },
      error: authError,
    } = await supabaseUserClient.auth.getUser()

    if (authError || !user) {
      return jsonResponse(req, { error: 'Unauthorized: invalid or expired session.' }, 401)
    }

    userId = user.id
    isGuest = Boolean((user as { is_anonymous?: boolean }).is_anonymous)

    const [profileRes, subRes, balanceRes] = await Promise.all([
      supabaseAdmin
        .from('profiles')
        .select('role, tier, is_suspended, suspended_reason')
        .eq('id', user.id)
        .maybeSingle(),
      supabaseAdmin
        .from('subscriptions')
        .select('tier, status, trial_ends_at, current_period_end')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabaseAdmin
        .from('user_balances')
        .select('tokens_remaining')
        .eq('user_id', user.id)
        .maybeSingle(),
    ])

    if (balanceRes.error) {
      return jsonResponse(req, { error: 'Failed to check token balance.' }, 500)
    }

    const profileRow = profileRes.data as {
      role?: string | null
      tier?: string | null
      is_suspended?: boolean | null
      suspended_reason?: string | null
    } | null

    const subRow = subRes.data as {
      tier?: string | null
      status?: string | null
      trial_ends_at?: string | null
      current_period_end?: string | null
    } | null

    isAdminUser = !isGuest && profileRow?.role === 'admin'

    if (!isAdminUser && profileRow?.is_suspended) {
      return jsonResponse(
        req,
        {
          error:
            profileRow.suspended_reason ||
            'Your account has been suspended by an administrator.',
          code: 'ACCOUNT_SUSPENDED',
          tokens_remaining: 0,
        },
        403,
      )
    }

    const effectiveTier = subRow?.tier ?? profileRow?.tier ?? 'free'
    const periodEndIso = subRow?.current_period_end ?? subRow?.trial_ends_at ?? null
    const periodExpired =
      !isAdminUser &&
      !isGuest &&
      (subRow?.status === 'canceled' ||
        (periodEndIso !== null && Date.parse(periodEndIso) <= Date.now()))

    if (periodExpired) {
      return jsonResponse(
        req,
        {
          error:
            effectiveTier === 'pro' || effectiveTier === 'enterprise'
              ? 'Your 1-month Pro period has ended. Upgrade to Lumina Tabula Pro to continue.'
              : 'Your 7-day free trial has ended. Upgrade to Lumina Tabula Pro to continue.',
          code: 'TRIAL_EXPIRED',
          tokens_remaining: 0,
        },
        402,
      )
    }

    const defaultTokens = isGuest
      ? GUEST_ID_TOKEN_LIMIT
      : effectiveTier === 'enterprise'
        ? 25_000_000
        : effectiveTier === 'pro'
          ? 5_000_000
          : 250_000

    tokensRemaining = isAdminUser
      ? 50_000_000
      : (balanceRes.data?.tokens_remaining ?? defaultTokens)

    if (!balanceRes.data && !isAdminUser) {
      await supabaseAdmin
        .from('user_balances')
        .upsert({ user_id: user.id, tokens_remaining: defaultTokens }, { onConflict: 'user_id' })
    }
  } else if (UUID_RE.test(guestHeader)) {
    // 1b. No-login guest trial: enforce BOTH guest_id balance AND server-side IP-hash daily cap
    // so clearing localStorage, cookies, or using Incognito cannot reset free guest tokens.
    guestId = guestHeader
    isGuest = true

    const clientIp = getClientIp(req)
    guestIpHash = await hashClientIp(clientIp, supabaseServiceRoleKey.slice(0, 32))

    const [guestRes, ipRes] = await Promise.all([
      supabaseAdmin
        .from('guest_balances')
        .select('tokens_remaining')
        .eq('guest_id', guestId)
        .maybeSingle(),
      supabaseAdmin
        .from('guest_ip_limits')
        .select('tokens_remaining, window_started_at')
        .eq('ip_hash', guestIpHash)
        .maybeSingle(),
    ])

    if (guestRes.error || ipRes.error) {
      return jsonResponse(
        req,
        {
          error: 'Sign in or create a free account to continue.',
          code: 'GUEST_LIMIT_REACHED',
          tokens_remaining: 0,
        },
        403,
      )
    }

    const nowIso = new Date().toISOString()
    const idRemaining = guestRes.data?.tokens_remaining ?? GUEST_ID_TOKEN_LIMIT

    const ipWindowExpired =
      !ipRes.data?.window_started_at ||
      Date.now() - Date.parse(ipRes.data.window_started_at) >= GUEST_WINDOW_MS

    if (!ipRes.data || ipWindowExpired) {
      guestIpRemaining = GUEST_IP_DAILY_TOKEN_LIMIT
    } else {
      guestIpRemaining = ipRes.data.tokens_remaining
    }

    // Do not block the DeepSeek call with initial upserts; persist in background.
    const initWrites: Promise<unknown>[] = []
    if (!guestRes.data) {
      initWrites.push(
        supabaseAdmin
          .from('guest_balances')
          .upsert(
            { guest_id: guestId, tokens_remaining: GUEST_ID_TOKEN_LIMIT, updated_at: nowIso },
            { onConflict: 'guest_id' },
          ),
      )
    }
    if (!ipRes.data || ipWindowExpired) {
      initWrites.push(
        supabaseAdmin.from('guest_ip_limits').upsert(
          {
            ip_hash: guestIpHash,
            tokens_remaining: GUEST_IP_DAILY_TOKEN_LIMIT,
            window_started_at: nowIso,
            updated_at: nowIso,
          },
          { onConflict: 'ip_hash' },
        ),
      )
    }
    if (initWrites.length > 0) {
      void Promise.all(initWrites).catch(() => undefined)
    }

    tokensRemaining = Math.min(idRemaining, guestIpRemaining)
  } else {
    return jsonResponse(req, { error: 'Missing or invalid Authorization header.' }, 401)
  }

  if (tokensRemaining <= 0) {
    return jsonResponse(
      req,
      {
        error: isGuest
          ? 'Your free guest tokens are used up. Sign in or create a free account to continue.'
          : 'You have run out of tokens.',
        code: isGuest ? 'GUEST_LIMIT_REACHED' : 'QUOTA_EXCEEDED',
        tokens_remaining: 0,
      },
      403,
    )
  }

  // 3. Parse and validate the incoming DeepSeek payload.
  let payload: Record<string, unknown>
  try {
    payload = (await req.json()) as Record<string, unknown>
  } catch {
    return jsonResponse(req, { error: 'Invalid JSON request body.' }, 400)
  }

  let model = typeof payload.model === 'string' ? payload.model : 'deepseek-v4-flash'
  if (!ALLOWED_MODELS.has(model)) {
    return jsonResponse(req, { error: `Unsupported model: ${model}` }, 400)
  }

  // Server-side guard on latest user question (300-word limit + block links/XSS/injection)
  const latestUserText = extractLastUserText(payload.messages).trim()
  if (latestUserText.length > 0) {
    const wordCount = latestUserText.split(/\s+/).filter(Boolean).length
    if (wordCount > MAX_USER_PROMPT_WORDS || latestUserText.length > MAX_USER_PROMPT_CHARS) {
      return jsonResponse(
        req,
        { error: `Questions are limited to ${MAX_USER_PROMPT_WORDS} words.` },
        400,
      )
    }
    if (UNSAFE_PROMPT_RE.test(latestUserText)) {
      return jsonResponse(
        req,
        { error: 'Links and scripts are not allowed in questions. Please ask in plain text.' },
        400,
      )
    }
  }
  if (isGuest && !GUEST_ALLOWED_MODELS.has(model)) {
    model = 'deepseek-v4-flash'
  }

  const isStreaming = payload.stream === true
  const requestedMaxTokens =
    typeof payload.max_tokens === 'number' && Number.isFinite(payload.max_tokens)
      ? Math.max(1, Math.floor(payload.max_tokens))
      : undefined
  const upstreamPayload: Record<string, unknown> = {
    ...payload,
    model,
    ...(isGuest
      ? {
          max_tokens: Math.min(requestedMaxTokens ?? 2048, 2048),
          thinking: { type: 'disabled' },
        }
      : {}),
    ...(isStreaming
      ? {
          stream_options: {
            ...(typeof payload.stream_options === 'object' && payload.stream_options !== null
              ? (payload.stream_options as Record<string, unknown>)
              : {}),
            include_usage: true,
          },
        }
      : {}),
  }

  // 4. Forward to DeepSeek API using the Edge Function Secret.
  const upstreamRes = await fetch(DEEPSEEK_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${deepseekApiKey}`,
    },
    body: JSON.stringify(upstreamPayload),
  })

  if (!upstreamRes.ok) {
    const errText = await upstreamRes.text().catch(() => 'DeepSeek request failed.')
    return new Response(errText, {
      status: upstreamRes.status,
      headers: {
        ...getCorsHeaders(req),
        'Content-Type': upstreamRes.headers.get('Content-Type') ?? 'application/json',
      },
    })
  }

  const deductTokens = async (usedTokens: number): Promise<number> => {
    if (usedTokens <= 0 || isAdminUser) return tokensRemaining
    if (guestId) {
      const nowIso = new Date().toISOString()
      const clampedId = Math.max(0, tokensRemaining - usedTokens)
      const clampedIp = Math.max(0, guestIpRemaining - usedTokens)
      await Promise.all([
        supabaseAdmin
          .from('guest_balances')
          .upsert(
            { guest_id: guestId, tokens_remaining: clampedId, updated_at: nowIso },
            { onConflict: 'guest_id' },
          ),
        guestIpHash
          ? supabaseAdmin
              .from('guest_ip_limits')
              .upsert(
                { ip_hash: guestIpHash, tokens_remaining: clampedIp, updated_at: nowIso },
                { onConflict: 'ip_hash' },
              )
          : Promise.resolve(),
      ])
      return Math.min(clampedId, clampedIp)
    }
    if (!userId) return tokensRemaining
    const { data: updated, error: rpcError } = await supabaseAdmin.rpc('deduct_user_tokens', {
      p_user_id: userId,
      p_tokens: usedTokens,
    })
    if (!rpcError && typeof updated === 'number') {
      return updated
    }
    const clamped = Math.max(0, tokensRemaining - usedTokens)
    await supabaseAdmin
      .from('user_balances')
      .update({ tokens_remaining: clamped })
      .eq('user_id', userId)
    return clamped
  }

  // 5a. Streaming response: pipe SSE chunks and deduct usage.total_tokens when stream ends.
  if (isStreaming && upstreamRes.body) {
    const decoder = new TextDecoder()
    let lineBuffer = ''
    let streamTotalTokens = 0

    const transform = new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        controller.enqueue(chunk)
        lineBuffer += decoder.decode(chunk, { stream: true })
        const lines = lineBuffer.split('\n')
        lineBuffer = lines.pop() ?? ''
        for (const line of lines) {
          const tokens = parseSseUsageChunk(line)
          if (tokens > 0) streamTotalTokens = tokens
        }
      },
      async flush() {
        if (lineBuffer) {
          const tokens = parseSseUsageChunk(lineBuffer)
          if (tokens > 0) streamTotalTokens = tokens
        }
        await deductTokens(streamTotalTokens)
      },
    })

    return new Response(upstreamRes.body.pipeThrough(transform), {
      status: 200,
      headers: {
        ...getCorsHeaders(req),
        'Content-Type': upstreamRes.headers.get('Content-Type') ?? 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
      },
    })
  }

  // 5b. Non-streaming response: deduct usage.total_tokens and return updated tokens_remaining.
  const data = (await upstreamRes.json()) as Record<string, unknown>
  const totalTokens = extractTotalTokens(data.usage)
  tokensRemaining = await deductTokens(totalTokens)

  return jsonResponse(
    req,
    {
      ...data,
      tokens_remaining: tokensRemaining,
    },
    200,
  )
})
