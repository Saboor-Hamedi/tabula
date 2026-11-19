import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from '../../core/router'
import { ROUTES } from '../../core/router/paths'
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
  const { navigate } = useRouter()
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

  const isGuestGate = Boolean(usage?.isGuest || pricingModalReason === 'guest-limit')
  const isExpired = Boolean(usage?.trialExpired || pricingModalReason === 'trial-expired')
  const isQuotaExceeded = pricingModalReason === 'quota-exceeded'
  const isPro = usage?.tier === 'pro' || usage?.tier === 'enterprise'

  if (isGuestGate) {
    const exhausted =
      pricingModalReason === 'guest-limit' ||
      (usage?.remainingTokens !== null &&
        usage?.remainingTokens !== undefined &&
        usage.remainingTokens <= 0)

    const guestContent = (
      <div className="modal-backdrop" onMouseDown={closePricingModal} role="presentation">
        <div
          className="pricing-modal-card is-compact"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pricing-modal-title"
          onMouseDown={(event) => event.stopPropagation()}
        >
          <div className="pricing-modal-head">
            <div>
              <span className="pricing-modal-kicker">Guest Trial</span>
              <h2 id="pricing-modal-title" className="pricing-modal-title">
                {exhausted ? 'Your free guest tokens are used up' : 'Create a free account'}
              </h2>
              <p className="pricing-modal-subtitle">
                {exhausted
                  ? 'Sign in or create a free account to unlock 250,000 tokens and a full 7-day trial — no credit card required.'
                  : 'Create a free account to unlock 250,000 tokens and keep analyzing your spreadsheets privately.'}
              </p>
            </div>
            <IconButton label="Close" size="sm" onClick={closePricingModal}>
              <CloseIcon size={16} />
            </IconButton>
          </div>

          <ul className="pricing-editorial-list" style={{ margin: '16px 0 22px' }}>
            <li>
              <CheckIcon size={13} /> 250,000 free tokens included on signup
            </li>
            <li>
              <CheckIcon size={13} /> Full 7-day workspace access — no card required
            </li>
            <li>
              <CheckIcon size={13} /> 100% private — your files never leave your device
            </li>
          </ul>

          <div className="pricing-guest-actions">
            <button
              type="button"
              className="pricing-editorial-btn is-accent"
              onClick={() => {
                closePricingModal()
                navigate(ROUTES.signUp)
              }}
            >
              <span>Create Free Account</span>
              <ArrowRightIcon size={14} />
            </button>
            <button
              type="button"
              className="pricing-editorial-btn is-outline"
              onClick={() => {
                closePricingModal()
                navigate(ROUTES.signIn)
              }}
            >
              Already have an account? Sign in
            </button>
          </div>
        </div>
      </div>
    )

    return typeof document !== 'undefined'
      ? createPortal(guestContent, document.body)
      : guestContent
  }

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
        <div className="pricing-modal-head">
          <div>
            <span className="pricing-modal-kicker">Plans &amp; Billing</span>
            <h2 id="pricing-modal-title" className="pricing-modal-title">
              {isExpired
                ? 'Your 7-day free trial has ended'
                : isQuotaExceeded
                  ? isPro
                    ? 'Monthly limit reached'
                    : 'Your trial tokens are finished'
                  : 'Upgrade your workspace'}
            </h2>
            <p className="pricing-modal-subtitle">
              {isExpired
                ? 'Your previous work stays safe on your device. Choose a plan to keep analyzing spreadsheets.'
                : isQuotaExceeded && !isPro
                  ? 'Upgrade to Pro Analyst to unlock 5,000,000 monthly tokens and unlimited spreadsheet analysis.'
                  : 'Simple monthly plans with zero hidden fees. Cancel anytime.'}
            </p>
          </div>
          <IconButton label="Close pricing" size="sm" onClick={closePricingModal}>
            <CloseIcon size={16} />
          </IconButton>
        </div>

        {usage ? (
          <div className="pricing-modal-usage-strip">
            <span>
              Used this month:{' '}
              <strong>
                {formatCount(usage.usedTokens)}
                {usage.monthlyLimit !== null ? ` / ${formatCount(usage.monthlyLimit)}` : ''}
              </strong>{' '}
              tokens
            </span>
            <span>
              Status:{' '}
              <strong>
                {usage.isAdmin
                  ? 'Admin'
                  : isPro
                    ? 'Pro Active'
                    : usage.trialExpired
                      ? 'Trial Ended'
                      : `Trial · ${usage.trialDaysRemaining ?? 0}d left`}
              </strong>
            </span>
          </div>
        ) : null}

        {/* 3-Card Editorial Grid matching the Front Page */}
        <div className="pricing-editorial-grid">
          {/* 1. 7-Day Trial */}
          <div className="pricing-editorial-card">
            <div>
              <span className="pricing-card-kicker">Try Free</span>
              <h3 className="pricing-card-name">7-Day Trial</h3>
              <p className="pricing-card-desc">
                Explore the workspace on your own spreadsheets with zero commitment.
              </p>
              <div className="pricing-card-price">
                <span className="pricing-card-num">$0</span>
                <span className="pricing-card-unit">/ 7 days</span>
              </div>
            </div>

            <ul className="pricing-editorial-list">
              <li>
                <CheckIcon size={13} /> Full workspace access for 7 days
              </li>
              <li>
                <CheckIcon size={13} /> 250,000 tokens included
              </li>
              <li>
                <CheckIcon size={13} /> Instant charts, tables &amp; summaries
              </li>
              <li>
                <CheckIcon size={13} /> 100% private — stays on your device
              </li>
            </ul>

            <button type="button" className="pricing-editorial-btn is-muted" disabled>
              {isPro
                ? 'Completed'
                : usage?.trialExpired
                  ? 'Trial Ended'
                  : `${usage?.trialDaysRemaining ?? 7} days remaining`}
            </button>
          </div>

          {/* 2. Pro Analyst (Centerpiece Obsidian Card) */}
          <div className="pricing-editorial-card is-ink">
            <div>
              <span className="pricing-card-kicker">Most Popular</span>
              <h3 className="pricing-card-name">Pro Analyst</h3>
              <p className="pricing-card-desc">
                For professionals, managers, and consultants working daily with data.
              </p>
              <div className="pricing-card-price">
                <span className="pricing-card-num">$19</span>
                <span className="pricing-card-unit">/ month</span>
              </div>
            </div>

            <ul className="pricing-editorial-list">
              <li>
                <CheckIcon size={13} /> <strong>5,000,000 monthly tokens</strong>
              </li>
              <li>
                <CheckIcon size={13} /> Unlimited rows &amp; multi-sheet workbooks
              </li>
              <li>
                <CheckIcon size={13} /> One-click PDF &amp; Word report exports
              </li>
              <li>
                <CheckIcon size={13} /> Compare multiple spreadsheets together
              </li>
              <li>
                <CheckIcon size={13} /> Priority email support
              </li>
            </ul>

            {isPro ? (
              <button
                type="button"
                className="pricing-editorial-btn is-light"
                onClick={() => void handleManageBilling()}
                disabled={submitting}
              >
                {submitting ? 'Opening Stripe…' : 'Manage Billing'}
              </button>
            ) : (
              <button
                type="button"
                className="pricing-editorial-btn is-light"
                onClick={() => void handleCheckout()}
                disabled={submitting}
              >
                <span>{submitting ? 'Redirecting…' : 'Upgrade with Stripe'}</span>
                {!submitting ? <ArrowRightIcon size={13} /> : null}
              </button>
            )}
          </div>

          {/* 3. Business */}
          <div className="pricing-editorial-card">
            <div>
              <span className="pricing-card-kicker">For Teams</span>
              <h3 className="pricing-card-name">Business</h3>
              <p className="pricing-card-desc">
                For finance, operations, and research teams sharing insights securely.
              </p>
              <div className="pricing-card-price">
                <span className="pricing-card-num">$49</span>
                <span className="pricing-card-unit">/ month</span>
              </div>
            </div>

            <ul className="pricing-editorial-list">
              <li>
                <CheckIcon size={13} /> <strong>Everything in Pro Analyst</strong>
              </li>
              <li>
                <CheckIcon size={13} /> Published report hub for stakeholders
              </li>
              <li>
                <CheckIcon size={13} /> Centralized team billing &amp; seats
              </li>
              <li>
                <CheckIcon size={13} /> Zero-upload compliance ready
              </li>
              <li>
                <CheckIcon size={13} /> Dedicated priority support
              </li>
            </ul>

            <button
              type="button"
              className="pricing-editorial-btn is-outline"
              onClick={() => void handleCheckout()}
              disabled={submitting}
            >
              <span>{submitting ? 'Redirecting…' : 'Choose Business'}</span>
              {!submitting ? <ArrowRightIcon size={13} /> : null}
            </button>
          </div>
        </div>

        {error ? (
          <div className="pricing-modal-error" role="alert">
            <AlertIcon size={15} />
            <span>{error}</span>
          </div>
        ) : null}

        <div className="pricing-modal-foot">
          <span className="pricing-modal-trust">
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
