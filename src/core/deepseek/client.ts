import { createDeepSeek } from '@ai-sdk/deepseek'
import type { ModelId } from '../types'

export function createDeepSeekModel(apiKey: string, modelId: ModelId) {
  const provider = createDeepSeek({ apiKey })
  return provider(modelId)
}

export function buildProviderOptions(modelId: ModelId) {
  if (modelId === 'deepseek-v4-pro') {
    return {
      deepseek: {
        thinking: { type: 'enabled' as const },
        reasoningEffort: 'high' as const,
      },
    }
  }
  return undefined
}
