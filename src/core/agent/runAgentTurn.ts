import { stepCountIs, streamText, type ModelMessage } from 'ai'
import type {
  ChatMessage,
  DatasetDigest,
  ExecutedCodeStep,
  ModelId,
  Session,
  ToolTraceEntry,
} from '../types'
import type { PythonExecutionResult } from '../python'
import { MAX_AGENT_STEPS } from '../constants'
import { createDeepSeekModel, buildProviderOptions } from '../deepseek/client'
import { getDuckDBHandle } from '../duckdb/initDuckDB'
import { buildSystemPrompt } from './systemPrompt'
import { createAgentTools } from './tools'
import type { ToolContext } from './executeTool'
import { extractStreamingCodeArg } from '../../tabula/utils/agentHelpers'

export interface AgentTurnInput {
  model: ModelId
  session: Session
  /** Live dataset digest, injected into the system prompt each turn. */
  digest: DatasetDigest | null
  allSessions?: Session[]
  digestBySession?: Record<string, DatasetDigest>
  history: ChatMessage[]
  userText: string
  /** Optional one-turn context (e.g. target code block to edit) excluded from UI bubble. */
  hiddenContext?: string
  signal: AbortSignal
  onDelta: (delta: string) => void
  onTrace: (entry: ToolTraceEntry) => void
  onPythonResult?: (result: PythonExecutionResult) => void
  onCodeStep?: (step: ExecutedCodeStep) => void
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
const MAX_HISTORY_MESSAGES = 6
const MAX_HISTORY_CHARS = 9_000

function compactOlderAssistantMessage(content: string): string {
  // Strip large chart/mermaid/code blocks and long markdown tables from older turns
  // so follow-up turns don't re-send thousands of redundant tokens.
  const withoutBlocks = content
    .replace(/```(?:mermaid|chart)\b[\s\S]*?```/g, '[chart omitted]')
    .replace(/```(?:python|py|sql)\b[\s\S]*?```/gi, '[code omitted]')
  const lines = withoutBlocks.split('\n')
  const compacted: string[] = []
  let tableRows = 0
  let omittedRows = 0
  for (const line of lines) {
    const isTableLine = /^\s*\|.*\|\s*$/.test(line)
    if (isTableLine) {
      tableRows += 1
      if (tableRows <= 4) {
        compacted.push(line)
      } else {
        omittedRows += 1
      }
    } else {
      if (omittedRows > 0) {
        compacted.push(`… [${omittedRows} rows omitted]`)
        omittedRows = 0
      }
      tableRows = 0
      compacted.push(line)
    }
  }
  if (omittedRows > 0) {
    compacted.push(`… [${omittedRows} rows omitted]`)
  }
  const result = compacted.join('\n').trim()
  return result.length > 1200 ? `${result.slice(0, 1160)}\n… [truncated]` : result
}

function toModelMessages(
  history: ChatMessage[],
  userText: string,
  hiddenContext?: string,
): ModelMessage[] {
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
    let raw = typeof message?.content === 'string' ? message.content.trim() : ''
    if (!raw) continue
    // If the most recent assistant message had executed code steps that weren't in prose,
    // include a compact reference so follow-up "edit that code" turns have context.
    if (
      message.role === 'assistant' &&
      !seenAssistant &&
      Array.isArray(message.codeSteps) &&
      message.codeSteps.length > 0 &&
      !/```(?:python|py|sql)\b/i.test(raw)
    ) {
      const lastStep = message.codeSteps[message.codeSteps.length - 1]
      if (lastStep?.code) {
        const snippet =
          lastStep.code.length > 900 ? `${lastStep.code.slice(0, 900)}\n# ...` : lastStep.code
        raw = `${raw}\n\n\`\`\`${lastStep.language}\n${snippet}\n\`\`\``
      }
    }
    const isOlderAssistant = message.role === 'assistant' && seenAssistant
    if (message.role === 'assistant') seenAssistant = true
    const content = isOlderAssistant ? compactOlderAssistantMessage(raw) : raw
    if (selected.length > 0 && characters + content.length > MAX_HISTORY_CHARS) break
    selected.unshift({ role: message.role, content })
    characters += content.length
  }

  const finalUserContent = hiddenContext?.trim()
    ? `${userText}\n\n${hiddenContext.trim()}`
    : userText
  selected.push({ role: 'user', content: finalUserContent })
  return selected
}

const PREAMBLE_LINE_RE =
  /^(?:(?:first|to begin|now|next|okay|sure|certainly),?\s+)?(?:i(?:'ll| will|'m going to| am going to)|let me|let's)\s+(?:start|begin|examine|explore|inspect|check|look|analyze|analyse|review|load|merge|read|understand|profile|investigate|gather|pull|calculate|compute|summarize)[^.!?\n]*[.!?]?\s*$/i

export function stripLeadingPreamble(raw: string): string {
  const lines = raw.split('\n')
  while (lines.length > 0) {
    const first = lines[0].trim()
    if (!first) {
      lines.shift()
      continue
    }
    if (PREAMBLE_LINE_RE.test(first)) {
      lines.shift()
      continue
    }
    // Also strip if the first paragraph starts with a preamble sentence followed by real content
    const sentenceMatch =
      /^(?:(?:first|to begin|now|next),?\s+)?(?:i(?:'ll| will|'m going to| am going to)|let me|let's)\s+(?:start|begin|examine|explore|inspect|check|look|analyze|analyse|review|load|merge|read|understand|profile|investigate|gather|pull|calculate|compute|summarize)[^.!?\n]*[.!?]\s+/i.exec(
        lines[0],
      )
    if (sentenceMatch) {
      lines[0] = lines[0].slice(sentenceMatch[0].length)
      if (!lines[0].trim()) lines.shift()
      continue
    }
    break
  }
  return lines.join('\n').trim()
}

function formatFallbackAnswer(pyResult?: PythonExecutionResult): string {
  const preview = pyResult?.dfPreview
  if (preview && Array.isArray(preview.columns) && preview.columns.length > 0) {
    const cols = preview.columns.slice(0, 10)
    const rows = (preview.rows ?? []).slice(0, 15)
    const esc = (v: string) => String(v ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ').trim() || '—'
    const header = `| ${cols.map(esc).join(' | ')} |`
    const sep = `| ${cols.map(() => '---').join(' | ')} |`
    const body = rows.map((r) => `| ${cols.map((_, i) => esc(r[i] ?? '')).join(' | ')} |`).join('\n')
    const intro = `Here is your prepared dataset (**${(preview.totalRows ?? rows.length).toLocaleString()} rows × ${preview.totalCols ?? cols.length} columns**). You can view or download the complete spreadsheet using **Open Excel**:`
    return rows.length > 0 ? `${intro}\n\n${header}\n${sep}\n${body}` : intro
  }
  if (Array.isArray(pyResult?.images) && pyResult.images.length > 0) {
    return 'Here is the chart generated from your data:'
  }
  const stdout = pyResult?.stdout?.trim()
  if (stdout) {
    const snippet = stdout.length > 1500 ? `${stdout.slice(0, 1500)}…` : stdout
    return `Here is the summary from your data:\n\n${snippet}`
  }
  return 'Your data has been processed and is ready to view.'
}

export async function runAgentTurn({
  model,
  session,
  digest,
  allSessions,
  digestBySession,
  history,
  userText,
  hiddenContext,
  signal,
  onDelta,
  onTrace,
  onPythonResult,
  onCodeStep,
}: AgentTurnInput): Promise<AgentTurnResult> {
  let lastPythonResult: PythonExecutionResult | undefined

  const toolContext: ToolContext = {
    handle: getDuckDBHandle(),
    sessionId: session.id,
    schemaName: session.schemaName,
    primaryTable: session.primaryTable ?? undefined,
    tableNames: Array.isArray(session?.tables) ? session.tables.map((table) => table.name) : [],
    tables: Array.isArray(session?.tables) ? session.tables : [],
    allSessions,
    onTrace,
    onPythonResult: (pyResult) => {
      lastPythonResult = pyResult
      onPythonResult?.(pyResult)
    },
    onCodeStep,
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
    messages: toModelMessages(history, userText, hiddenContext),
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
  let activeStreamTool: { id: string; name: string; rawJson: string } | null = null

  for await (const part of result.fullStream) {
    if (signal.aborted) break
    if (part.type === 'start-step') {
      activeStreamTool = null
      if (text.trim().length > 0 && !text.endsWith('\n\n')) {
        needsStepSeparator = true
      }
      continue
    }
    if (part.type === 'tool-input-start') {
      const toolId =
        (part as { id?: string; toolCallId?: string }).id ??
        (part as { toolCallId?: string }).toolCallId ??
        'live-stream-step'
      activeStreamTool = { id: toolId, name: part.toolName, rawJson: '' }
      continue
    }
    if (part.type === 'tool-input-delta' && activeStreamTool) {
      const deltaChunk =
        (part as { delta?: string; inputTextDelta?: string }).delta ??
        (part as { inputTextDelta?: string }).inputTextDelta ??
        ''
      activeStreamTool.rawJson += deltaChunk
      const isPy = activeStreamTool.name === 'run_python'
      const isSq = activeStreamTool.name === 'run_sql'
      if (isPy || isSq) {
        const liveCode = extractStreamingCodeArg(
          activeStreamTool.rawJson,
          isSq ? 'sql' : 'code',
        )
        if (liveCode.length > 0) {
          onCodeStep?.({
            id: 'live-stream-step',
            language: isSq ? 'sql' : 'python',
            code: liveCode,
            status: 'running',
          })
        }
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
  let answer = ''

  if (!signal.aborted) {
    try {
      const steps = await result.steps
      const lastFinalStep = [...steps]
        .reverse()
        .find((s) => s.text?.trim() && (!s.toolCalls || s.toolCalls.length === 0))
      const lastTextStep = [...steps].reverse().find((s) => s.text?.trim())
      if (lastFinalStep?.text?.trim()) {
        answer = lastFinalStep.text
      } else if (safeFinal.length > 0) {
        answer = finalText
      } else if (lastTextStep?.text?.trim()) {
        answer = lastTextStep.text
      } else if (safeText.length > 0) {
        answer = text
      } else {
        const toolCalls = steps.flatMap((s) => s.toolCalls ?? [])
        if (toolCalls.length > 0) {
          answer = formatFallbackAnswer(lastPythonResult)
        }
      }
    } catch {
      answer = safeFinal.length > 0 ? finalText : safeText.length > 0 ? text : ''
    }
  } else {
    answer = safeFinal.length > 0 ? finalText : text
  }

  answer = stripLeadingPreamble(answer)

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
