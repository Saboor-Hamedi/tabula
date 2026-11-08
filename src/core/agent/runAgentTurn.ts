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
}

/**
 * Converts stored chat messages into model messages.
 *
 * Welcome messages and error messages are dropped: they are UI artifacts, not
 * conversation. Keeping them out also stops the transcript from growing a
 * boilerplate preamble on every turn.
 */
function toModelMessages(history: ChatMessage[], userText: string): ModelMessage[] {
  const messages: ModelMessage[] = []

  for (const message of history) {
    const content = message.content.trim()
    if (content.length === 0 || message.error || message.welcome) continue
    messages.push({ role: message.role, content })
  }

  messages.push({ role: 'user', content: userText })
  return messages
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

  const answer = text.trim().length > 0 ? text : finalText
  if (answer.trim().length === 0) {
    throw new Error('The model returned an empty response. Try asking again.')
  }

  return { text: answer }
}
