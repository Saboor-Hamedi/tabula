import { stepCountIs, streamText, type ModelMessage } from 'ai'
import type { ChatMessage, DatasetDigest, ModelId, Session, ToolTraceEntry } from '../types'
import { MAX_AGENT_STEPS } from '../constants'
import { createDeepSeekModel, buildProviderOptions } from '../deepseek/client'
import { getDuckDBHandle } from '../duckdb/initDuckDB'
import { buildSystemPrompt } from './systemPrompt'
import { createAgentTools } from './tools'
import type { ToolContext } from './executeTool'

export interface AgentTurnInput {
  apiKey: string
  model: ModelId
  session: Session
  /** Live dataset digest, injected into the system prompt each turn. */
  digest: DatasetDigest | null
  history: ChatMessage[]
  userText: string
  signal: AbortSignal
  onDelta: (delta: string) => void
  onTrace: (entry: ToolTraceEntry) => void
}

export interface AgentTurnResult {
  text: string
  usage?: {
    inputTokens: number
    outputTokens: number
  }
}

/**
 * Converts stored chat messages into model messages.
 *
 * Welcome messages and error messages are dropped: they are UI artifacts, not
 * conversation. Keeping them out also stops the transcript from growing a
 * boilerplate preamble on every turn.
 */
const MAX_HISTORY_MESSAGES = 12
const MAX_HISTORY_CHARS = 24_000

function toModelMessages(history: ChatMessage[], userText: string): ModelMessage[] {
  const safeHistory = Array.isArray(history) ? history : []
  const cleaned = safeHistory
    .filter(
      (message) =>
        typeof message?.content === 'string' &&
        message.content.trim().length > 0 &&
        !message.error &&
        !message.welcome,
    )
    .slice(-MAX_HISTORY_MESSAGES)

  // Keep the newest messages that fit the context budget, then restore order.
  const selected: ModelMessage[] = []
  let characters = 0
  for (let index = cleaned.length - 1; index >= 0; index -= 1) {
    const message = cleaned[index]
    const content = typeof message?.content === 'string' ? message.content.trim() : ''
    if (!content) continue
    if (selected.length > 0 && characters + content.length > MAX_HISTORY_CHARS) break
    selected.unshift({ role: message.role, content })
    characters += content.length
  }

  selected.push({ role: 'user', content: userText })
  return selected
}

export async function runAgentTurn({
  apiKey,
  model,
  session,
  digest,
  history,
  userText,
  signal,
  onDelta,
  onTrace,
}: AgentTurnInput): Promise<AgentTurnResult> {
  const toolContext: ToolContext = {
    handle: getDuckDBHandle(),
    sessionId: session.id,
    schemaName: session.schemaName,
    tableNames: session.tables.map((table) => table.name),
    tables: session.tables,
    onTrace,
  }

  const tools = createAgentTools(toolContext)

  let streamError: Error | null = null

  const result = streamText({
    model: createDeepSeekModel(apiKey, model),
    system: buildSystemPrompt({
      fileName: session.fileName,
      tables: session.tables,
      digest,
    }),
    messages: toModelMessages(history, userText),
    tools,
    stopWhen: stepCountIs(MAX_AGENT_STEPS),
    abortSignal: signal,
    maxRetries: 1,
    providerOptions: buildProviderOptions(model),
    onError: ({ error }) => {
      streamError = error instanceof Error ? error : new Error(String(error))
    },
  })

  let text = ''
  for await (const delta of result.textStream) {
    if (signal.aborted) break
    text += delta
    onDelta(delta)
  }

  // `result.text` is the authoritative final value; the stream can be cut short.
  let finalText = ''
  if (!signal.aborted) {
    try {
      finalText = await result.text
    } catch (error) {
      if (!streamError) {
        streamError = error instanceof Error ? error : new Error(String(error))
      }
    }
  }

  if (streamError) throw streamError
  if (signal.aborted) return { text }

  const safeText = typeof text === 'string' ? text.trim() : ''
  const safeFinal = typeof finalText === 'string' ? finalText.trim() : ''
  const answer = safeText.length > 0 ? text : safeFinal
  if (answer.trim().length === 0) {
    throw new Error('The model returned an empty response. Try asking again.')
  }

  let usage: AgentTurnResult['usage']
  try {
    const reported = await result.usage
    usage = {
      inputTokens: reported.inputTokens ?? 0,
      outputTokens: reported.outputTokens ?? 0,
    }
  } catch {
    usage = undefined
  }

  return { text: answer, usage }
}
