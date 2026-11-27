import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { IconButton } from '../../common/IconButton'
import { ArrowRightIcon, CheckIcon, CloseIcon } from '../../common/Icons'

export interface DonationModalProps {
  open: boolean
  onClose: () => void
}

const PAYPAL_BASE_URL = 'https://paypal.me/saboor10'
const PRESET_AMOUNTS = [5, 10, 25, 50] as const

export function HeartIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
    </svg>
  )
}

function PayPalIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944 2.79A.859.859 0 0 1 5.792 2h7.367c2.441 0 4.212.564 5.263 1.677.982 1.038 1.338 2.473.998 4.265-.56 2.948-2.463 4.862-5.654 5.689-.61.158-1.318.237-2.104.237H8.836a.86.86 0 0 0-.848.725l-1.08 6.135a.642.642 0 0 1-.632.609h.8z" />
    </svg>
  )
}

export function DonationModal({ open, onClose }: DonationModalProps) {
  const [selectedAmount, setSelectedAmount] = useState<number>(10)
  const [customAmount, setCustomAmount] = useState<string>('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) return null

  const effectiveAmount = customAmount.trim()
    ? Math.max(1, Math.min(10000, Math.round(Number(customAmount) || 10)))
    : selectedAmount

  const paypalUrl =
    effectiveAmount > 0 ? `${PAYPAL_BASE_URL}/${effectiveAmount}` : PAYPAL_BASE_URL

  const handleCopyLink = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(PAYPAL_BASE_URL)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    }
  }

  const modal = (
    <div
      className="modal-backdrop"
      onMouseDown={onClose}
      role="presentation"
    >
      <div
        className="lumina-paypal-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="lumina-paypal-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="lumina-paypal-head">
          <div className="lumina-paypal-brand-badge">
            <PayPalIcon />
            <span>PayPal</span>
          </div>
          <IconButton label="Close donation modal" size="sm" onClick={onClose}>
            <CloseIcon size={15} />
          </IconButton>
        </div>

        <h2 id="lumina-paypal-title" className="lumina-paypal-title">
          Support Lumina
        </h2>
        <p className="lumina-paypal-desc">
          Lumina is 100% free, local-first, and open-source. Your contribution helps fund native
          Rust &amp; Tauri development and cross-platform installers.
        </p>

        {/* Amount Pills */}
        <div className="lumina-paypal-amounts" role="group" aria-label="Select donation amount">
          {PRESET_AMOUNTS.map((amt) => {
            const isSelected = !customAmount.trim() && selectedAmount === amt
            return (
              <button
                key={amt}
                type="button"
                className={`lumina-paypal-amt-pill ${isSelected ? 'is-active' : ''}`}
                onClick={() => {
                  setCustomAmount('')
                  setSelectedAmount(amt)
                }}
              >
                ${amt}
              </button>
            )
          })}

          <div className={`lumina-paypal-custom-box ${customAmount.trim() ? 'is-active' : ''}`}>
            <span>$</span>
            <input
              type="number"
              min={1}
              max={10000}
              value={customAmount}
              onChange={(e) => setCustomAmount(e.target.value)}
              placeholder="Custom"
              aria-label="Custom USD amount"
            />
          </div>
        </div>

        {/* Primary PayPal Action */}
        <a
          href={paypalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="lumina-paypal-cta-btn"
          onClick={onClose}
        >
          <PayPalIcon />
          <span>Donate ${effectiveAmount} via PayPal</span>
          <ArrowRightIcon size={14} />
        </a>

        {/* Copyable PayPal.me Link Row */}
        <div className="lumina-paypal-link-bar">
          <span className="lumina-paypal-link-text">paypal.me/saboor10</span>
          <button
            type="button"
            className="lumina-paypal-copy-btn"
            onClick={handleCopyLink}
          >
            {copied ? (
              <>
                <CheckIcon size={12} />
                <span>Copied</span>
              </>
            ) : (
              <span>Copy link</span>
            )}
          </button>
        </div>
      </div>
    </div>
  )

  return typeof document !== 'undefined' ? createPortal(modal, document.body) : modal
}
