import { stepCountIs, streamText, type ModelMessage } from 'ai'
import type { ChatMessage, DatasetDigest, ModelId, Session, ToolTraceEntry } from '../types'
import type { PythonExecutionResult } from '../python'
import { MAX_AGENT_STEPS } from '../constants'
import { createDeepSeekModel, buildProviderOptions } from '../deepseek/client'
import { getDuckDBHandle } from '../duckdb/initDuckDB'
import { buildSystemPrompt } from './systemPrompt'
import { createAgentTools } from './tools'
import type { ToolContext } from './executeTool'

export interface AgentTurnInput {
  model: ModelId
  session: Session
  /** Live dataset digest, injected into the system prompt each turn. */
  digest: DatasetDigest | null
  allSessions?: Session[]
  digestBySession?: Record<string, DatasetDigest>
  history: ChatMessage[]
  userText: string
  signal: AbortSignal
  onDelta: (delta: string) => void
  onTrace: (entry: ToolTraceEntry) => void
  onPythonResult?: (result: PythonExecutionResult) => void
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
const MAX_HISTORY_MESSAGES = 8
const MAX_HISTORY_CHARS = 12_000

function compactOlderAssistantMessage(content: string): string {
  // Strip large chart/mermaid blocks and long markdown tables from older turns
  // so follow-up turns don't re-send thousands of redundant tokens.
  const withoutCharts = content.replace(
    /```(?:mermaid|chart)\b[\s\S]*?```/g,
    '[chart omitted]',
  )
  const lines = withoutCharts.split('\n')
  const compacted: string[] = []
  let tableRows = 0
  let omittedRows = 0
  for (const line of lines) {
    const isTableLine = /^\s*\|.*\|\s*$/.test(line)
    if (isTableLine) {
      tableRows += 1
      if (tableRows <= 5) {
        compacted.push(line)
      } else {
        omittedRows += 1
      }
    } else {
      if (omittedRows > 0) {
        compacted.push(`… [${omittedRows} table rows omitted]`)
        omittedRows = 0
      }
      tableRows = 0
      compacted.push(line)
    }
  }
  if (omittedRows > 0) {
    compacted.push(`… [${omittedRows} table rows omitted]`)
  }
  const result = compacted.join('\n').trim()
  return result.length > 1600 ? `${result.slice(0, 1560)}\n… [truncated]` : result
}

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
  let seenAssistant = false
  for (let index = cleaned.length - 1; index >= 0; index -= 1) {
    const message = cleaned[index]
    const raw = typeof message?.content === 'string' ? message.content.trim() : ''
    if (!raw) continue
    const isOlderAssistant = message.role === 'assistant' && seenAssistant
    if (message.role === 'assistant') seenAssistant = true
    const content = isOlderAssistant ? compactOlderAssistantMessage(raw) : raw
    if (selected.length > 0 && characters + content.length > MAX_HISTORY_CHARS) break
    selected.unshift({ role: message.role, content })
    characters += content.length
  }

  selected.push({ role: 'user', content: userText })
  return selected
}

export async function runAgentTurn({
  model,
  session,
  digest,
  allSessions,
  digestBySession,
  history,
  userText,
  signal,
  onDelta,
  onTrace,
  onPythonResult,
}: AgentTurnInput): Promise<AgentTurnResult> {
  const toolContext: ToolContext = {
    handle: getDuckDBHandle(),
    sessionId: session.id,
    schemaName: session.schemaName,
    primaryTable: session.primaryTable ?? undefined,
    tableNames: Array.isArray(session?.tables) ? session.tables.map((table) => table.name) : [],
    tables: Array.isArray(session?.tables) ? session.tables : [],
    allSessions,
    onTrace,
    onPythonResult,
  }

  const tools = createAgentTools(toolContext)

  let streamError: Error | null = null

  const result = streamText({
    model: createDeepSeekModel(model),
    system: buildSystemPrompt({
      fileName: session.fileName,
      activeSessionId: session.id,
      tables: session.tables,
      digest,
      allSessions,
      digestBySession,
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
  let needsStepSeparator = false
  for await (const part of result.fullStream) {
    if (signal.aborted) break
    if (part.type === 'start-step') {
      if (text.trim().length > 0 && !text.endsWith('\n\n')) {
        needsStepSeparator = true
      }
      continue
    }
    if (part.type === 'text-delta' && part.text) {
      const prefix = needsStepSeparator
        ? text.endsWith('\n')
          ? '\n'
          : '\n\n'
        : ''
      needsStepSeparator = false
      const chunk = `${prefix}${part.text}`
      text += chunk
      onDelta(chunk)
    }
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
  let answer = safeText.length > 0 ? text : safeFinal

  if (answer.trim().length === 0) {
    // Attempt recovery from steps if multi-step tool call ran without final text delta
    try {
      const steps = await result.steps
      const texts = steps
        .map((s) => s.text?.trim())
        .filter((t): t is string => Boolean(t && t.length > 0))
      if (texts.length > 0) {
        answer = texts.join('\n\n')
      } else {
        const toolCalls = steps.flatMap((s) => s.toolCalls ?? [])
        if (toolCalls.length > 0) {
          const toolsCalled = toolCalls.map((tc) => `\`${tc.toolName}\``).join(', ')
          answer = `Completed execution with ${toolsCalled}. The transformed data is available in the table and on the Results inspector tab.`
        }
      }
    } catch {
      // Ignore step recovery error
    }
  }

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
