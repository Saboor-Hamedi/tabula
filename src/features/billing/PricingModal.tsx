import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  closePricingModal,
  openStripeBillingPortal,
  startStripeCheckout,
  useUsageStatus,
} from '../../core/supabase/usage'
import { formatCount } from '../../core/utils/format'
import {
  AlertIcon,
  ArrowRightIcon,
  CheckIcon,
  CloseIcon,
  ShieldCheckIcon,
} from '../common/Icons'
import { IconButton } from '../common/IconButton'

export function PricingModal() {
  const { usage, pricingModalOpen, pricingModalReason } = useUsageStatus()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!pricingModalOpen) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closePricingModal()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [pricingModalOpen])

  if (!pricingModalOpen) return null

  const isExpired = Boolean(usage?.trialExpired || pricingModalReason === 'trial-expired')
  const isQuotaExceeded = pricingModalReason === 'quota-exceeded'
  const isPro = usage?.tier === 'pro' || usage?.tier === 'enterprise'

  const handleCheckout = async () => {
    setSubmitting(true)
    setError(null)
    try {
      const url = await startStripeCheckout()
      window.location.assign(url)
    } catch (checkoutError) {
      setError(
        checkoutError instanceof Error
          ? checkoutError.message
          : 'Could not start Stripe Checkout.',
      )
      setSubmitting(false)
    }
  }

  const handleManageBilling = async () => {
    setSubmitting(true)
    setError(null)
    try {
      const url = await openStripeBillingPortal()
      window.location.assign(url)
    } catch (portalError) {
      setError(
        portalError instanceof Error
          ? portalError.message
          : 'Could not open billing portal.',
      )
      setSubmitting(false)
    }
  }

  const content = (
    <div className="modal-backdrop" onMouseDown={closePricingModal} role="presentation">
      <div
        className="pricing-modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pricing-modal-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <h2 id="pricing-modal-title" className="modal-title">
              {isExpired
                ? 'Your 7-day free trial has ended'
                : isQuotaExceeded
                  ? isPro
                    ? 'Monthly token limit reached'
                    : 'You have finished your trial tokens'
                  : 'Upgrade to Lumina Tabula Pro'}
            </h2>
            <p className="modal-subtitle">
              {isExpired
                ? 'You can still sign in and review previous work. Upgrade with Stripe to upload new data and receive Lumina Tabula AI responses.'
                : isQuotaExceeded && !isPro
                  ? 'You have used all 250,000 free trial tokens. Upgrade to Lumina Tabula Pro with Stripe to unlock 5,000,000 monthly tokens.'
                  : 'Unlock full AI spreadsheet analysis, 5,000,000 monthly tokens, and executive exports.'}
            </p>
          </div>
          <IconButton label="Close pricing" size="sm" onClick={closePricingModal}>
            <CloseIcon size={16} />
          </IconButton>
        </div>

        {usage ? (
          <div className="pricing-modal-usage-strip">
            <span>
              Tokens spent this month:{' '}
              <strong>
                {formatCount(usage.usedTokens)}
                {usage.monthlyLimit !== null ? ` / ${formatCount(usage.monthlyLimit)}` : ''}
              </strong>{' '}
              ({formatCount(usage.inputTokens)} in · {formatCount(usage.outputTokens)} out)
            </span>
            <span>
              Status:{' '}
              <strong>
                {usage.isAdmin
                  ? 'Admin'
                  : isPro
                    ? 'Pro Active'
                    : usage.trialExpired
                      ? 'Trial Expired'
                      : `Trial · ${usage.trialDaysRemaining ?? 0}d left`}
              </strong>
            </span>
          </div>
        ) : null}

        <div className="pricing-modal-grid">
          <div className="pricing-plan-card">
            <div>
              <h3 className="pricing-plan-title">7-Day Free Trial</h3>
              <p className="pricing-plan-desc">Included automatically on signup, no card required.</p>
              <div className="pricing-plan-price">
                <span className="pricing-plan-amount">$0</span>
                <span className="pricing-plan-period">/ 7 days</span>
              </div>
            </div>

            <ul className="pricing-plan-features">
              <li>
                <CheckIcon size={14} /> 7 full days of dataset uploads & AI analysis
              </li>
              <li>
                <CheckIcon size={14} /> 250,000 monthly AI tokens included
              </li>
              <li>
                <CheckIcon size={14} /> In-browser DuckDB SQL & Python analytics
              </li>
              <li>
                <CheckIcon size={14} /> No bank account or payment needed to start
              </li>
            </ul>

            <button type="button" className="btn btn-ghost" disabled>
              {isPro
                ? 'Completed'
                : usage?.trialExpired
                  ? 'Trial Ended'
                  : `${usage?.trialDaysRemaining ?? 7} days remaining`}
            </button>
          </div>

          <div className="pricing-plan-card is-featured">
            <div className="pricing-plan-pill">Recommended</div>
            <div>
              <h3 className="pricing-plan-title">Pro Analyst</h3>
              <p className="pricing-plan-desc">Unlimited spreadsheet uploads & full Lumina Tabula AI access.</p>
              <div className="pricing-plan-price">
                <span className="pricing-plan-amount">$19</span>
                <span className="pricing-plan-period">/ month</span>
              </div>
            </div>

            <ul className="pricing-plan-features">
              <li>
                <CheckIcon size={14} /> Unlimited CSV & Excel uploads
              </li>
              <li>
                <CheckIcon size={14} /> 5,000,000 tokens / month (V4 Flash & Pro)
              </li>
              <li>
                <CheckIcon size={14} /> Executive PDF, Word & HTML reports
              </li>
              <li>
                <CheckIcon size={14} /> Instant activation via Stripe Checkout
              </li>
            </ul>

            {isPro ? (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => void handleManageBilling()}
                disabled={submitting}
              >
                {submitting ? 'Opening Stripe…' : 'Manage Stripe Billing'}
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => void handleCheckout()}
                disabled={submitting}
              >
                <span>{submitting ? 'Redirecting to Stripe…' : 'Pay with Stripe'}</span>
                {!submitting ? <ArrowRightIcon size={14} /> : null}
              </button>
            )}
          </div>
        </div>

        {error ? (
          <div className="pricing-modal-error" role="alert">
            <AlertIcon size={15} />
            <span>{error}</span>
          </div>
        ) : null}

        <div className="pricing-modal-foot">
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <ShieldCheckIcon size={14} /> Secured by Stripe · Cancel anytime
          </span>
          <button type="button" className="btn btn-ghost btn-small" onClick={closePricingModal}>
            Close
          </button>
        </div>
      </div>
    </div>
  )

  return typeof document !== 'undefined' ? createPortal(content, document.body) : content
}
