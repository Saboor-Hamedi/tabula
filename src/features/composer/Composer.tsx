import { openPricingModal, useUsageStatus } from '../../core/supabase/usage'
import { validateUserPrompt } from '../../core/utils/promptGuard'
import { LockIcon } from '../common/Icons'
import { useSessionActions, useSessionState } from '../SessionProvider'
import { Input } from '../chat'
import { useComposerDraft } from './useComposerDraft'

/**
 * Composer.
 *
 * The composer is the width reference for the whole conversation: the chat
 * column and every assistant response share its exact width, so the transcript
 * reads as one column instead of a stack of differently-sized boxes.
 *
 * The draft is kept in a module-level store, so switching datasets or opening
 * settings never loses what the user was typing.
 */

export function Composer() {
  const { activeSession, sessions, isStreaming, dbReady } = useSessionState()
  const { sendMessage, stopStreaming } = useSessionActions()
  const { usage } = useUsageStatus()
  const [value, setValue] = useComposerDraft()

  const isGuest = Boolean(usage?.isGuest)
  const trialExpired = Boolean(usage?.trialExpired)
  const quotaExhausted = Boolean(
    usage &&
      !usage.isAdmin &&
      usage.monthlyLimit !== null &&
      usage.remainingTokens !== null &&
      usage.remainingTokens <= 0,
  )
  const blockedReason = trialExpired
    ? 'trial-expired'
    : quotaExhausted
      ? (isGuest ? 'guest-limit' : 'quota-exceeded')
      : null
  const disabled = !activeSession || !dbReady || blockedReason !== null

  const handleSubmit = () => {
    if (blockedReason) {
      openPricingModal(blockedReason)
      return
    }
    const check = validateUserPrompt(value)
    if (!check.ok) return
    setValue('')
    void sendMessage(check.sanitized)
  }

  return (
    <div className="composer">
      <div className="composer-inner">
        {blockedReason ? (
          <div className="composer-trial-bar" role="status">
            <span className="composer-trial-bar-left">
              <LockIcon size={13} />
              <span>
                {blockedReason === 'quota-exceeded'
                  ? 'Trial tokens finished'
                  : '7-day free trial ended'}
              </span>
            </span>
            <button
              type="button"
              className="btn btn-primary btn-small"
              onClick={() => openPricingModal(blockedReason)}
            >
              Upgrade to Lumina Tabula Pro
            </button>
          </div>
        ) : null}

        {activeSession ? (
          <div className="composer-chips">
            {sessions.length > 1 ? (
              <>
                <button
                  type="button"
                  className="chip chip-action"
                  disabled={disabled || isStreaming}
                  onClick={() =>
                    void sendMessage(
                      'Merge all uploaded files into one clean unified dataset, normalize headers, and show the full summary and class/source breakdown.',
                    )
                  }
                >
                  Merge All Files
                </button>
                <button
                  type="button"
                  className="chip chip-action"
                  disabled={disabled || isStreaming}
                  onClick={() =>
                    void sendMessage(
                      'Compare all uploaded files side-by-side across key metrics, distributions, and top performers.',
                    )
                  }
                >
                  Compare Sources
                </button>
              </>
            ) : null}
            <button
              type="button"
              className="chip chip-action"
              disabled={disabled || isStreaming}
              onClick={() =>
                void sendMessage(
                  'Summarize the most important trends, top performers, and biggest changes in this spreadsheet in plain English with a clear chart.',
                )
              }
            >
              Summarize Trends
            </button>
            <button
              type="button"
              className="chip chip-action"
              disabled={disabled || isStreaming}
              onClick={() =>
                void sendMessage(
                  'Create a clean, easy-to-read chart highlighting the main story in this spreadsheet.',
                )
              }
            >
              Build a Chart
            </button>
            <button
              type="button"
              className="chip chip-action"
              disabled={disabled || isStreaming}
              onClick={() =>
                void sendMessage(
                  'Check this spreadsheet for blank cells, duplicate rows, unusual values, or formatting issues, and explain them simply.',
                )
              }
            >
              Check for Errors
            </button>
            <button
              type="button"
              className="chip chip-action"
              disabled={disabled || isStreaming}
              onClick={() =>
                void sendMessage(
                  'Generate a clear executive summary report with key takeaways, a clean chart, a compact summary table, and practical next steps.',
                )
              }
            >
              Executive Report
            </button>
          </div>
        ) : null}

        <Input
          value={value}
          onChange={setValue}
          onSubmit={handleSubmit}
          onStop={stopStreaming}
          disabled={disabled}
          streaming={isStreaming}
          placeholder={
            blockedReason === 'quota-exceeded' || blockedReason === 'guest-limit'
              ? 'Trial tokens finished — upgrade to Lumina Tabula Pro to continue…'
              : blockedReason === 'trial-expired'
                ? 'Trial ended — upgrade to Lumina Tabula Pro to ask questions…'
                : !activeSession
                  ? 'Upload a file to begin…'
                  : !dbReady
                    ? 'Initializing analysis engine…'
                    : 'Ask questions, analyze trends, or request a summary…'
          }
        />
      </div>
    </div>
  )
}
