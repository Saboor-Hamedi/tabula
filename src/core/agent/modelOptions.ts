import type { ModelId } from '../types'
import { DEFAULT_MODEL } from '../constants'

export interface ModelOption {
  id: ModelId
  label: string
  shortLabel: string
  description: string
  badge: string
}

export const MODEL_OPTIONS: readonly ModelOption[] = [
  {
    id: 'deepseek-v4-flash',
    label: 'DeepSeek V4 Flash',
    shortLabel: 'V4 Flash',
    description: 'Fast, efficient everyday analysis. Best for most questions.',
    badge: 'Default',
  },
  {
    id: 'deepseek-v4-pro',
    label: 'DeepSeek V4 Pro',
    shortLabel: 'V4 Pro',
    description: 'Deeper reasoning for complex, multi-step investigations.',
    badge: 'Deep',
  },
]

export function isModelId(value: string | null | undefined): value is ModelId {
  return MODEL_OPTIONS.some((option) => option.id === value)
}

export function getModelOption(id: ModelId): ModelOption {
  return MODEL_OPTIONS.find((option) => option.id === id) ?? MODEL_OPTIONS[0]
}

export function resolveModelId(value: string | null | undefined): ModelId {
  if (isModelId(value)) return value
  if (isModelId(DEFAULT_MODEL)) return DEFAULT_MODEL
  return MODEL_OPTIONS[0].id
}
