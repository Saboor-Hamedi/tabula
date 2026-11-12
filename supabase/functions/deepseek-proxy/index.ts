import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

function getCorsHeaders(req: Request): Record<string, string> {
  const requestedHeaders = req.headers.get('Access-Control-Request-Headers')
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers':
      requestedHeaders || 'authorization, x-client-info, apikey, content-type, user-agent',
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
  if (!authHeader.startsWith('Bearer ')) {
    return jsonResponse(req, { error: 'Missing or invalid Authorization header.' }, 401)
  }

  // 1. Verify the caller's Supabase JWT to get their authenticated user_id.
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

  // 2. Check user_balances using the service_role client.
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: balanceRow, error: balanceError } = await supabaseAdmin
    .from('user_balances')
    .select('tokens_remaining')
    .eq('user_id', user.id)
    .maybeSingle()

  if (balanceError) {
    return jsonResponse(req, { error: 'Failed to check token balance.' }, 500)
  }

  let tokensRemaining = balanceRow?.tokens_remaining ?? 250000
  if (!balanceRow) {
    await supabaseAdmin
      .from('user_balances')
      .upsert({ user_id: user.id, tokens_remaining: 250000 }, { onConflict: 'user_id' })
  }

  if (tokensRemaining <= 0) {
    return jsonResponse(
      req,
      {
        error: 'You have run out of tokens.',
        code: 'QUOTA_EXCEEDED',
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

  const model = typeof payload.model === 'string' ? payload.model : 'deepseek-v4-flash'
  if (!ALLOWED_MODELS.has(model)) {
    return jsonResponse(req, { error: `Unsupported model: ${model}` }, 400)
  }

  const isStreaming = payload.stream === true
  const upstreamPayload: Record<string, unknown> = {
    ...payload,
    model,
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
    if (usedTokens <= 0) return tokensRemaining
    const { data: updated, error: rpcError } = await supabaseAdmin.rpc('deduct_user_tokens', {
      p_user_id: user.id,
      p_tokens: usedTokens,
    })
    if (!rpcError && typeof updated === 'number') {
      return updated
    }
    const clamped = Math.max(0, tokensRemaining - usedTokens)
    await supabaseAdmin
      .from('user_balances')
      .update({ tokens_remaining: clamped })
      .eq('user_id', user.id)
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
