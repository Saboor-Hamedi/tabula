/**
 * Client-side prompt length & security guard.
 *
 * Enforces the 300-word / 3,000-character cap and blocks pasted hacking links,
 * script/HTML injection, dangerous URI schemes, and BiDi spoofing characters.
 * The same rules are also enforced server-side in `deepseek-proxy`.
 */

export const MAX_PROMPT_WORDS = 300
export const MAX_PROMPT_CHARS = 3000

const INVISIBLE_CONTROL_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200F\u202A-\u202E\u2066-\u2069]/g

const DANGEROUS_SCHEME_OR_XSS_RE =
  /(?:javascript:|vbscript:|file:\/\/|data:text\/html|<\s*\/?\s*(?:script|iframe|object|embed|svg|img|link|meta)\b|on(?:error|load|click|mouseover|focus)\s*=|\beval\s*\(|document\.cookie|window\.location)/i

const EXTERNAL_OR_INTERNAL_URL_RE =
  /(?:https?:\/\/[^\s]+|\bwww\.[a-z0-9-]+(?:\.[a-z0-9-]+)+(?:\/[^\s]*)?|\b(?:127\.0\.0\.1|169\.254\.169\.254|0\.0\.0\.0|localhost)(?::\d+)?(?:\/[^\s]*)?)/i

export function stripUnsafeControls(text: string): string {
  return text.replace(INVISIBLE_CONTROL_RE, '')
}

export function countWords(text: string): number {
  const trimmed = text.trim()
  if (!trimmed) return 0
  return trimmed.split(/\s+/).length
}

/**
 * Truncates text cleanly to at most `maxWords` words and `maxChars` characters,
 * preserving trailing whitespace when the user is still under the word limit.
 */
export function clampPromptInput(
  raw: string,
  maxWords = MAX_PROMPT_WORDS,
  maxChars = MAX_PROMPT_CHARS,
): string {
  const cleaned = stripUnsafeControls(raw)
  const charClamped = cleaned.length > maxChars ? cleaned.slice(0, maxChars) : cleaned

  const words = charClamped.trim().split(/\s+/).filter(Boolean)
  if (words.length <= maxWords) {
    return charClamped
  }

  // Match up to the Nth word boundary while preserving original spacing/newlines.
  let seen = 0
  let inWord = false
  for (let i = 0; i < charClamped.length; i += 1) {
    const isSpace = /\s/.test(charClamped[i])
    if (!isSpace && !inWord) {
      seen += 1
      if (seen > maxWords) {
        return charClamped.slice(0, i).trimEnd()
      }
      inWord = true
    } else if (isSpace) {
      inWord = false
    }
  }

  return charClamped
}

export interface PromptValidationResult {
  ok: boolean
  sanitized: string
  wordCount: number
  error: string | null
}

export function validateUserPrompt(raw: string): PromptValidationResult {
  const sanitized = stripUnsafeControls(raw).trim()
  const wordCount = countWords(sanitized)

  if (!sanitized) {
    return { ok: false, sanitized, wordCount: 0, error: null }
  }

  if (wordCount > MAX_PROMPT_WORDS) {
    return {
      ok: false,
      sanitized,
      wordCount,
      error: `Questions are limited to ${MAX_PROMPT_WORDS} words (currently ${wordCount}).`,
    }
  }

  if (sanitized.length > MAX_PROMPT_CHARS) {
    return {
      ok: false,
      sanitized,
      wordCount,
      error: `Message is too long. Please keep it under ${MAX_PROMPT_CHARS.toLocaleString()} characters.`,
    }
  }

  if (DANGEROUS_SCHEME_OR_XSS_RE.test(sanitized)) {
    return {
      ok: false,
      sanitized,
      wordCount,
      error: 'Unsafe scripts or code links are not allowed. Please ask in plain English.',
    }
  }

  if (EXTERNAL_OR_INTERNAL_URL_RE.test(sanitized)) {
    return {
      ok: false,
      sanitized,
      wordCount,
      error: 'Web links are not allowed in questions. Please describe what you want to analyze in plain text.',
    }
  }

  return { ok: true, sanitized, wordCount, error: null }
}
