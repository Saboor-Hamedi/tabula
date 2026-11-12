import { openPricingModal, useUsageStatus } from '../../core/supabase/usage'
import { formatCount } from '../../core/utils/format'
import { ZapIcon } from '../common/Icons'

/**
 * Compact sidebar quota & trial meter shown to every signed-in user.
 */
export function UsageQuotaCard() {
  const { usage, loading } = useUsageStatus()

  if (!usage && !loading) return null
  if (loading && !usage) {
    return (
      <div className="quota-card" aria-live="polite">
        <div className="quota-card-top">
          <span className="quota-plan-badge">Checking quota…</span>
        </div>
      </div>
    )
  }
  if (!usage) return null

  const isPro = usage.tier === 'pro' || usage.tier === 'enterprise'
  const limit = usage.monthlyLimit
  const pct =
    limit && limit > 0 ? Math.min(100, Math.round((usage.usedTokens / limit) * 100)) : 0
  const barTone =
    usage.trialExpired || pct >= 95 ? 'is-danger' : pct >= 80 ? 'is-warn' : ''

  const badgeLabel = usage.isAdmin
    ? 'Admin · Unlimited'
    : isPro
      ? 'Pro Plan'
      : usage.trialExpired
        ? 'Trial Ended'
        : `Trial · ${usage.trialDaysRemaining ?? 0}d left`

  return (
    <div
      className={`quota-card ${usage.trialExpired ? 'is-expired' : ''}`}
      title={`Input: ${usage.inputTokens.toLocaleString()} · Output: ${usage.outputTokens.toLocaleString()} tokens`}
    >
      <div className="quota-card-top">
        <span
          className={`quota-plan-badge ${
            usage.trialExpired ? 'is-expired' : isPro || usage.isAdmin ? 'is-pro' : ''
          }`}
        >
          <ZapIcon size={11} />
          <span>{badgeLabel}</span>
        </span>

        {!usage.isAdmin && !isPro ? (
          <button
            type="button"
            className="quota-upgrade-link"
            onClick={() => openPricingModal(usage.trialExpired ? 'trial-expired' : 'upgrade')}
          >
            {usage.trialExpired ? 'Pay now' : 'Upgrade'}
          </button>
        ) : null}
      </div>

      {limit !== null ? (
        <div className="quota-bar-track" aria-hidden>
          <div className={`quota-bar-fill ${barTone}`} style={{ width: `${pct}%` }} />
        </div>
      ) : null}

      <div className="quota-meta">
        <span>
          {formatCount(usage.usedTokens)}
          {limit !== null ? ` / ${formatCount(limit)} tokens` : ' tokens spent'}
        </span>
        {usage.remainingTokens !== null ? (
          <span>{formatCount(usage.remainingTokens)} left</span>
        ) : (
          <span>{usage.queryCount} queries</span>
        )}
      </div>

      <div className="quota-submeta">
        {formatCount(usage.inputTokens)} in · {formatCount(usage.outputTokens)} out this month
      </div>
    </div>
  )
}
