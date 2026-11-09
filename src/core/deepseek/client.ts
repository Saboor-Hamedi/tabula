import { createDeepSeek } from '@ai-sdk/deepseek'
import { PROXY_BASE_URL, USES_SERVER_PROXY } from '../config'
import type { ModelId } from '../types'

export function createDeepSeekModel(apiKey: string, modelId: ModelId) {
  const provider = createDeepSeek(
    USES_SERVER_PROXY
      ? { apiKey: 'server-proxy', baseURL: PROXY_BASE_URL }
      : { apiKey },
  )
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
