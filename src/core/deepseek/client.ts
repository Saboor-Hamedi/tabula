import { createDeepSeek } from '@ai-sdk/deepseek'
import { PROXY_BASE_URL } from '../config'
import { supabase } from '../supabase/client'
import { openPricingModal, refreshUsage } from '../supabase/usage'
import type { ModelId } from '../types'

async function managedProxyFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const headers = new Headers(init?.headers)

  // Replace the SDK's placeholder key header with the signed-in user's session JWT
  // so the server proxy verifies the user and applies the single platform API key.
  headers.delete('authorization')
  if (supabase) {
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    if (token) {
      headers.set('authorization', `Bearer ${token}`)
    }
  }

  const response = await fetch(input, { ...init, headers })

  if (response.status === 402) {
    void refreshUsage()
    openPricingModal('trial-expired')
  } else if (response.status === 429) {
    void refreshUsage()
  }

  return response
}

export function createDeepSeekModel(modelId: ModelId) {
  const baseURL =
    typeof window !== 'undefined' ? `${window.location.origin}${PROXY_BASE_URL}` : PROXY_BASE_URL

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
