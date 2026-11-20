import { createDeepSeek } from '@ai-sdk/deepseek'
import { PROXY_BASE_URL } from '../config'
import { supabase, supabaseAnonKey, supabaseUrl } from '../supabase/client'
import {
  openPricingModal,
  refreshUsage,
  setLiveTokensRemaining,
} from '../supabase/usage'
import type { ModelId } from '../types'

export type BillingBlockReason = 'trial-expired' | 'quota-exceeded' | 'guest-limit'

export class BillingBlockError extends Error {
  readonly reason: BillingBlockReason
  readonly isRetryable = false

  constructor(reason: BillingBlockReason, message: string) {
    super(message)
    this.name = 'BillingBlockError'
    this.reason = reason
  }
}

export function getBillingBlockReason(error: unknown): BillingBlockReason | null {
  const visited = new Set<unknown>()
  let current: unknown = error
  while (current && typeof current === 'object' && !visited.has(current)) {
    visited.add(current)
    if (current instanceof BillingBlockError) {
      return current.reason
    }
    const candidate = current as {
      reason?: unknown
      statusCode?: unknown
      responseBody?: unknown
      lastError?: unknown
      cause?: unknown
      errors?: unknown[]
    }
    if (
      candidate.reason === 'quota-exceeded' ||
      candidate.reason === 'trial-expired' ||
      candidate.reason === 'guest-limit'
    ) {
      return candidate.reason
    }
    if (candidate.statusCode === 403 || candidate.statusCode === 402) {
      return candidate.statusCode === 402 ? 'trial-expired' : 'guest-limit'
    }
    if (typeof candidate.responseBody === 'string') {
      if (candidate.responseBody.includes('GUEST_LIMIT_REACHED') || candidate.responseBody.includes('guest')) return 'guest-limit'
      if (candidate.responseBody.includes('QUOTA_EXCEEDED')) return 'quota-exceeded'
      if (candidate.responseBody.includes('TRIAL_EXPIRED')) return 'trial-expired'
    }
    if (Array.isArray(candidate.errors)) {
      for (const nested of candidate.errors) {
        const reason = getBillingBlockReason(nested)
        if (reason) return reason
      }
    }
    current = candidate.lastError ?? candidate.cause
  }
  return null
}

const GUEST_ID_KEY = 'tabula_guest_id'

function getOrCreateGuestId(): string {
  try {
    const existing = localStorage.getItem(GUEST_ID_KEY)
    if (existing && /^[0-9a-f-]{36}$/i.test(existing)) return existing
    const created =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : '00000000-0000-4000-8000-000000000000'
    localStorage.setItem(GUEST_ID_KEY, created)
    return created
  } catch {
    return '00000000-0000-4000-8000-000000000000'
  }
}

async function managedProxyFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const headers = new Headers(init?.headers)

  // Replace the SDK's placeholder key header with the signed-in user's session JWT,
  // or attach a stable guest ID header for no-login trial access.
  headers.delete('authorization')
  if (supabaseAnonKey) {
    headers.set('apikey', supabaseAnonKey)
  }
  let isGuestSession = true
  if (supabase) {
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    if (token) {
      headers.set('authorization', `Bearer ${token}`)
      isGuestSession = Boolean(data.session?.user?.is_anonymous)
    } else {
      headers.set('x-tabula-guest-id', getOrCreateGuestId())
    }
  } else {
    headers.set('x-tabula-guest-id', getOrCreateGuestId())
  }

  let response: Response
  try {
    response = await fetch(input, { ...init, headers })
  } catch {
    throw new Error('Could not connect right now. Please check your internet connection and try again.')
  }

  if (response.status === 401 && isGuestSession) {
    openPricingModal('guest-limit')
    throw new BillingBlockError(
      'guest-limit',
      'Sign in or create a free account to continue analyzing your spreadsheet.',
    )
  }

  if (response.status === 402 || response.status === 403 || response.status === 429) {
    const payload = (await response
      .clone()
      .json()
      .catch(() => null)) as { code?: string; error?: string; tokens_remaining?: number } | null

    if (typeof payload?.tokens_remaining === 'number') {
      setLiveTokensRemaining(payload.tokens_remaining)
    }

    if (payload?.code === 'ACCOUNT_SUSPENDED') {
      void refreshUsage()
      throw new Error(
        payload.error || 'Your account has been suspended by an administrator.',
      )
    }

    if (
      payload?.code === 'GUEST_LIMIT_REACHED' ||
      (isGuestSession && (response.status === 403 || payload?.code === 'QUOTA_EXCEEDED')) ||
      (response.status === 403 && /guest/i.test(payload?.error ?? ''))
    ) {
      void refreshUsage()
      openPricingModal('guest-limit')
      throw new BillingBlockError(
        'guest-limit',
        payload?.error ??
          'You have used all trial tokens. Upgrade to Lumina Tabula Pro to continue.',
      )
    }

    if (
      payload?.code === 'QUOTA_EXCEEDED' ||
      (response.status === 403 && payload?.tokens_remaining === 0) ||
      (response.status === 403 && /out of tokens/i.test(payload?.error ?? ''))
    ) {
      void refreshUsage()
      openPricingModal('quota-exceeded')
      throw new BillingBlockError(
        'quota-exceeded',
        payload?.error ?? 'You have run out of tokens.',
      )
    }

    if (response.status === 402 || payload?.code === 'TRIAL_EXPIRED') {
      void refreshUsage()
      openPricingModal('trial-expired')
      throw new BillingBlockError(
        'trial-expired',
        payload?.error ?? 'Your 7-day free trial has ended.',
      )
    }

    if (response.status === 403) {
      void refreshUsage()
      const reason: BillingBlockReason = isGuestSession ? 'guest-limit' : 'quota-exceeded'
      openPricingModal(reason)
      throw new BillingBlockError(
        reason,
        payload?.error ?? 'You have used all trial tokens. Upgrade to Lumina Tabula Pro to continue.',
      )
    }

    void refreshUsage()
    return response
  }

  const contentType = response.headers.get('content-type') ?? ''
  if (response.ok && contentType.includes('text/event-stream') && response.body) {
    // Refresh live user_balances right when the SSE stream finishes.
    const stream = response.body.pipeThrough(
      new TransformStream<Uint8Array, Uint8Array>({
        transform(chunk, controller) {
          controller.enqueue(chunk)
        },
        flush() {
          void refreshUsage()
        },
      }),
    )
    return new Response(stream, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    })
  }

  if (response.ok && contentType.includes('application/json')) {
    const payload = (await response
      .clone()
      .json()
      .catch(() => null)) as { tokens_remaining?: unknown } | null
    if (typeof payload?.tokens_remaining === 'number') {
      setLiveTokensRemaining(payload.tokens_remaining)
    }
    void refreshUsage()
  }

  return response
}

export function getDeepSeekProxyBaseUrl(): string {
  if (supabaseUrl) {
    return `${supabaseUrl}/functions/v1/deepseek-proxy`
  }
  return typeof window !== 'undefined' ? `${window.location.origin}${PROXY_BASE_URL}` : PROXY_BASE_URL
}

export function createDeepSeekModel(modelId: ModelId) {
  const baseURL = getDeepSeekProxyBaseUrl()

  const provider = createDeepSeek({
    apiKey: 'tabula-managed',
    baseURL,
    fetch: managedProxyFetch,
  })
  return provider(modelId)
}

export function buildProviderOptions(modelId: ModelId) {
  if (modelId === 'deepseek-v4-pro') {
    return {
      deepseek: {
        thinking: { type: 'enabled' as const },
        reasoningEffort: 'low' as const,
      },
    }
  }

  // Flash is the everyday/default model. V4 turns thinking on by default, which
  // adds seconds before the first token; disable it so answers start streaming
  // immediately. Pro remains available when deeper reasoning is worth the wait.
  return {
    deepseek: {
      thinking: { type: 'disabled' as const },
    },
  }
}

/**
 * Suggestions are a latency-sensitive side task. Disabling thinking keeps them
 * cheap and fast even when the user has selected the deeper analysis model.
 */
export function buildSuggestionProviderOptions() {
  return {
    deepseek: {
      thinking: { type: 'disabled' as const },
    },
  }
}
