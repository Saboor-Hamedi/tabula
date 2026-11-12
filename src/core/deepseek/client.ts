import { createDeepSeek } from '@ai-sdk/deepseek'
import { PROXY_BASE_URL } from '../config'
import { supabase, supabaseAnonKey, supabaseUrl } from '../supabase/client'
import {
  openPricingModal,
  refreshUsage,
  setLiveTokensRemaining,
} from '../supabase/usage'
import type { ModelId } from '../types'

export type BillingBlockReason = 'trial-expired' | 'quota-exceeded'

export class BillingBlockError extends Error {
  readonly reason: BillingBlockReason

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
    if (candidate.reason === 'quota-exceeded' || candidate.reason === 'trial-expired') {
      return candidate.reason
    }
    if (typeof candidate.responseBody === 'string') {
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

async function managedProxyFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const headers = new Headers(init?.headers)

  // Replace the SDK's placeholder key header with the signed-in user's session JWT
  // so the Supabase Edge Function (`deepseek-proxy`) verifies the user and applies
  // the DEEPSEEK_API_KEY Edge Function Secret.
  headers.delete('authorization')
  if (supabaseAnonKey) {
    headers.set('apikey', supabaseAnonKey)
  }
  if (supabase) {
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    if (token) {
      headers.set('authorization', `Bearer ${token}`)
    }
  }

  let response: Response
  try {
    response = await fetch(input, { ...init, headers })
  } catch (networkError) {
    const detail = networkError instanceof Error ? networkError.message : String(networkError)
    throw new Error(
      `Could not reach the deepseek-proxy Supabase Edge Function (${detail}). Make sure it is deployed with: supabase functions deploy deepseek-proxy --no-verify-jwt`,
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

    if (response.status === 402) {
      void refreshUsage()
      openPricingModal('trial-expired')
      throw new BillingBlockError(
        'trial-expired',
        payload?.error ?? 'Your 7-day free trial has ended.',
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
