import { useMemo } from 'react'
import {
  findDimensions,
  findEntityColumn,
  findMeasures,
  humanizeColumn,
} from '../../core/agent/suggestions'
import { openPricingModal, useUsageStatus } from '../../core/supabase/usage'
import { validateUserPrompt } from '../../core/utils/promptGuard'
import {
  ActivityIcon,
  DatabaseIcon,
  FileIcon,
  LockIcon,
  SearchIcon,
  SparklesIcon,
  TableIcon,
} from '../common/Icons'
import { useSessionActions, useSessionState } from '../SessionProvider'
import { Input } from '../chat'
import { useComposerDraft } from './useComposerDraft'

/**
 * Studio Composer.
 *
 * Features dynamic data-aware quick chips derived from the active dataset's
 * columns and loaded workspace files, plus a sleek elevated prompt input.
 */

export function Composer() {
  const { activeSession, sessions, digest, isStreaming, dbReady } = useSessionState()
  const { sendMessage, stopStreaming } = useSessionActions()
  const { usage } = useUsageStatus()
  const [value, setValue] = useComposerDraft()

  const isGuest = Boolean(usage?.isGuest)
  const isSuspended = Boolean(usage?.isSuspended)
  const trialExpired = !isSuspended && Boolean(usage?.trialExpired)
  const quotaExhausted = Boolean(
    usage &&
      !usage.isAdmin &&
      !isSuspended &&
      usage.monthlyLimit !== null &&
      usage.remainingTokens !== null &&
      usage.remainingTokens <= 0,
  )
  const blockedReason = trialExpired
    ? 'trial-expired'
    : quotaExhausted
      ? isGuest
        ? 'guest-limit'
        : 'quota-exceeded'
      : null
  const disabled = !activeSession || !dbReady || isSuspended || blockedReason !== null

  const quickChips = useMemo(() => {
    if (!activeSession) return []
    const primaryTable = activeSession.primaryTable || activeSession.tables?.[0]?.name || 'dataset'
    const digestTable =
      digest?.tables?.find((t) => t.name === primaryTable) || digest?.tables?.[0]
    const totalRows =
      activeSession.tables?.reduce((sum, t) => sum + (t.rowCount || 0), 0) ?? 0
    const cols = (digestTable?.columns ?? []).filter(
      (c) => !/^column_\d+$/i.test(c.name.trim()),
    )

    const measures = findMeasures(cols)
    const dimensions = findDimensions(cols, totalRows)
    const entity = findEntityColumn(cols, totalRows)

    const m1 = measures[0] ? humanizeColumn(measures[0].name) : null
    const m2 = measures[1] ? humanizeColumn(measures[1].name) : null
    const d1 = dimensions[0] ? humanizeColumn(dimensions[0].name) : null
    const ent = entity ? humanizeColumn(entity.name) : null

    const chips: Array<{
      label: string
      prompt: string
      icon: typeof ActivityIcon
    }> = []

    if (sessions.length > 1) {
      chips.push({
        icon: DatabaseIcon,
        label: `Combine & Compare (${sessions.length} files)`,
        prompt: m1
          ? `Combine all ${sessions.length} uploaded files into one dataset and compare average ${m1} across each group with a clean bar chart.`
          : `Combine all ${sessions.length} uploaded files into one dataset and compare their key metrics with a chart.`,
      })
    }

    if (d1 && m1) {
      chips.push({
        icon: ActivityIcon,
        label: `${m1} by ${d1}`,
        prompt: `Compare average and total ${m1} across each ${d1} group with a clean chart and summary table.`,
      })
    } else if (m1) {
      chips.push({
        icon: ActivityIcon,
        label: `Analyze ${m1}`,
        prompt: `Analyze the distribution, average, and key drivers of ${m1} with a clear chart.`,
      })
    }

    if (ent && m1 && ent !== d1) {
      chips.push({
        icon: TableIcon,
        label: `Top 10 ${ent}`,
        prompt: `Rank the top 10 ${ent} records by ${m1} and plot a comparison chart.`,
      })
    } else if (m1 && m2) {
      chips.push({
        icon: TableIcon,
        label: `${m1} vs ${m2}`,
        prompt: `Compare ${m1} and ${m2} across the dataset and visualize their relationship.`,
      })
    }

    chips.push({
      icon: SearchIcon,
      label: 'Outliers & Quality',
      prompt: m1
        ? `Check ${m1} and all columns for outliers, missing values, or unusual rows and summarize the findings.`
        : 'Check this dataset for missing values, duplicate rows, and unusual values.',
    })

    chips.push({
      icon: FileIcon,
      label: 'Executive Summary',
      prompt:
        'Generate a concise executive summary with the main headline finding, a key comparison chart, and top takeaways.',
    })

    return chips.slice(0, 4)
  }, [activeSession, digest, sessions.length])

  const handleSubmit = () => {
    if (isSuspended) return
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
        {isSuspended ? (
          <div className="composer-trial-bar" role="status">
            <span className="composer-trial-bar-left">
              <LockIcon size={13} />
              <span>
                {usage?.suspendedReason
                  ? `Account suspended: ${usage.suspendedReason}`
                  : 'Account suspended by administrator'}
              </span>
            </span>
          </div>
        ) : blockedReason ? (
          <div className="composer-trial-bar" role="status">
            <span className="composer-trial-bar-left">
              <LockIcon size={13} />
              <span>
                {blockedReason === 'quota-exceeded' || blockedReason === 'guest-limit'
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

        {activeSession && quickChips.length > 0 ? (
          <div className="composer-chips">
            {quickChips.map((chip) => {
              const Icon = chip.icon || SparklesIcon
              return (
                <button
                  key={chip.label}
                  type="button"
                  className="chip chip-action"
                  disabled={disabled || isStreaming}
                  onClick={() => void sendMessage(chip.prompt)}
                  title={chip.prompt}
                >
                  <Icon size={11} />
                  <span className="chip-text">{chip.label}</span>
                </button>
              )
            })}
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
                    : 'Ask a question about your data, request a chart, or compare groups…'
          }
        />
      </div>
    </div>
  )
}
