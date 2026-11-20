import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { formatCount } from '../../../core/utils/format'
import {
  AlertIcon,
  CheckIcon,
  CloseIcon,
  LockIcon,
  SearchIcon,
  SettingsIcon,
  ShieldCheckIcon,
  TrashIcon,
  ZapIcon,
} from '../../common/Icons'
import { Pagination } from '../../common/Pagination'
import { useAuthUser, useIsAdmin } from '../../auth/useProfile'
import {
  grantProByEmail,
  manageMemberAccess,
  revokeEmailGrant,
  type EmailGrantEntry,
  type Member,
  type MemberAdminAction,
} from '../api'

export interface MembersProps {
  members: Member[]
  emailGrants?: EmailGrantEntry[]
  loading?: boolean
  onRefresh?: () => Promise<void> | void
}

function formatDate(value: string | null): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function relativeTime(value: string | null): string {
  if (!value) return 'never'
  const time = new Date(value).getTime()
  if (Number.isNaN(time)) return 'never'
  const diff = Date.now() - time
  const minute = 60_000
  const hour = 60 * minute
  const day = 24 * hour
  if (diff < minute) return 'just now'
  if (diff < hour) return `${Math.floor(diff / minute)}m ago`
  if (diff < day) return `${Math.floor(diff / hour)}h ago`
  if (diff < 30 * day) return `${Math.floor(diff / day)}d ago`
  return formatDate(value)
}

function daysRemainingLabel(endIso: string | null): { text: string; expired: boolean } | null {
  if (!endIso) return null
  const ms = Date.parse(endIso) - Date.now()
  if (Number.isNaN(ms)) return null
  if (ms <= 0) return { text: 'Expired', expired: true }
  const days = Math.ceil(ms / 86_400_000)
  return { text: `${days}d left`, expired: false }
}

const PLAN_LABEL: Record<string, string> = {
  free: 'Free',
  pro: 'Pro',
  enterprise: 'Enterprise',
}

const STATUS_LABEL: Record<string, string> = {
  trialing: 'Trialing',
  active: 'Active',
  past_due: 'Past due',
  canceled: 'Canceled',
  unpaid: 'Unpaid',
  incomplete: 'Incomplete',
  suspended: 'Suspended',
  expired: 'Expired',
}

const DURATION_OPTIONS = [
  { days: 30, label: '1 Month (30 days)' },
  { days: 7, label: '7 Days' },
  { days: 60, label: '2 Months (60 days)' },
  { days: 90, label: '3 Months (90 days)' },
  { days: 180, label: '6 Months (180 days)' },
  { days: 365, label: '1 Year (365 days)' },
] as const

const TOKEN_PRESETS = [
  { label: '0', value: 0 },
  { label: '250K (Trial)', value: 250_000 },
  { label: '1M', value: 1_000_000 },
  { label: '5M (Pro)', value: 5_000_000 },
  { label: '25M (Enterprise)', value: 25_000_000 },
] as const

export function Members({
  members,
  emailGrants = [],
  loading = false,
  onRefresh,
}: MembersProps) {
  const isAdmin = useIsAdmin()
  const currentUser = useAuthUser()
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  // Grant Pro by Email form state
  const [grantEmail, setGrantEmail] = useState('')
  const [grantTier, setGrantTier] = useState<'pro' | 'enterprise'>('pro')
  const [grantDays, setGrantDays] = useState<number>(30)
  const [grantTokens, setGrantTokens] = useState<number>(5_000_000)
  const [grantNote, setGrantNote] = useState('')
  const [grantSubmitting, setGrantSubmitting] = useState(false)
  const [grantFeedback, setGrantFeedback] = useState<{
    type: 'success' | 'error'
    text: string
  } | null>(null)

  // Quick row action state
  const [busyMemberId, setBusyMemberId] = useState<string | null>(null)
  const [actionBanner, setActionBanner] = useState<{
    type: 'success' | 'error'
    text: string
  } | null>(null)

  // Manage Member Modal state
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null)
  const selectedMember = useMemo(
    () => members.find((m) => m.id === selectedMemberId) ?? null,
    [members, selectedMemberId],
  )
  const [customTokensInput, setCustomTokensInput] = useState<string>('5000000')
  const [customDaysInput, setCustomDaysInput] = useState<number>(30)
  const [suspendReasonInput, setSuspendReasonInput] = useState<string>('')
  const [confirmRemoveUser, setConfirmRemoveUser] = useState(false)
  const [modalBusy, setModalBusy] = useState(false)
  const [modalFeedback, setModalFeedback] = useState<{
    type: 'success' | 'error'
    text: string
  } | null>(null)

  useEffect(() => {
    if (selectedMember) {
      setCustomTokensInput(String(selectedMember.tokens_remaining ?? 5_000_000))
      setSuspendReasonInput(selectedMember.suspended_reason ?? '')
      setConfirmRemoveUser(false)
      setModalFeedback(null)
    }
  }, [selectedMember])

  useEffect(() => {
    if (!selectedMember) return
    const prevBodyOverflow = document.body.style.overflow
    const prevHtmlOverflow = document.documentElement.style.overflow
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !modalBusy) {
        setSelectedMemberId(null)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = prevBodyOverflow
      document.documentElement.style.overflow = prevHtmlOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [selectedMember, modalBusy])

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase()
    if (!term) return members
    return members.filter((member) =>
      [
        member.email,
        member.display_name,
        member.tier,
        member.role,
        member.is_suspended ? 'suspended' : '',
      ]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(term)),
    )
  }, [members, query])

  useEffect(() => {
    setPage(1)
  }, [query, pageSize])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const pagedMembers = useMemo(() => {
    const start = (safePage - 1) * pageSize
    return filtered.slice(start, start + pageSize)
  }, [filtered, safePage, pageSize])

  if (!isAdmin) return null

  const handleTierChangeForEmailGrant = (nextTier: 'pro' | 'enterprise') => {
    setGrantTier(nextTier)
    setGrantTokens(nextTier === 'enterprise' ? 25_000_000 : 5_000_000)
  }

  const handleGrantByEmail = async (event: FormEvent) => {
    event.preventDefault()
    const clean = grantEmail.trim().toLowerCase()
    if (!clean) return
    setGrantSubmitting(true)
    setGrantFeedback(null)

    try {
      const res = await grantProByEmail({
        email: clean,
        tier: grantTier,
        days: grantDays,
        tokens: grantTokens,
        note: grantNote.trim() || undefined,
      })

      setGrantFeedback({
        type: 'success',
        text:
          res.status === 'applied'
            ? `Upgraded ${res.email} to ${res.tier.toUpperCase()} for ${res.duration_days} days (${formatCount(res.tokens_remaining)} tokens).`
            : `Pre-approved ${res.email} for ${res.duration_days}-day ${res.tier.toUpperCase()} (${formatCount(res.tokens_remaining)} tokens). It will activate automatically when they sign up.`,
      })
      setGrantEmail('')
      setGrantNote('')
      await onRefresh?.()
    } catch (err) {
      setGrantFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Could not grant Pro access.',
      })
    } finally {
      setGrantSubmitting(false)
    }
  }

  const handleRevokeEmailGrant = async (email: string) => {
    try {
      await revokeEmailGrant(email)
      setActionBanner({
        type: 'success',
        text: `Removed email grant for ${email}.`,
      })
      await onRefresh?.()
    } catch (err) {
      setActionBanner({
        type: 'error',
        text: err instanceof Error ? err.message : 'Could not revoke email grant.',
      })
    }
  }

  const handleQuickMakePro = async (member: Member) => {
    setBusyMemberId(member.id)
    setActionBanner(null)
    try {
      await manageMemberAccess({
        targetUserId: member.id,
        action: 'grant_pro_month',
        tier: 'pro',
        days: 30,
        tokens: 5_000_000,
      })
      setActionBanner({
        type: 'success',
        text: `${member.display_name || member.email} is now Pro for 1 full month (30 days · 5,000,000 tokens).`,
      })
      await onRefresh?.()
    } catch (err) {
      setActionBanner({
        type: 'error',
        text: err instanceof Error ? err.message : 'Could not update member plan.',
      })
    } finally {
      setBusyMemberId(null)
    }
  }

  const handleModalAction = async (
    action: MemberAdminAction,
    options?: {
      tier?: 'free' | 'pro' | 'enterprise'
      days?: number
      tokens?: number
      reason?: string
      successMessage?: string
      closeAfter?: boolean
    },
  ) => {
    if (!selectedMember) return
    setModalBusy(true)
    setModalFeedback(null)
    try {
      await manageMemberAccess({
        targetUserId: selectedMember.id,
        action,
        tier: options?.tier,
        days: options?.days ?? customDaysInput,
        tokens: options?.tokens,
        reason: options?.reason,
      })
      await onRefresh?.()
      if (options?.closeAfter) {
        setSelectedMemberId(null)
        setActionBanner({
          type: 'success',
          text: options.successMessage ?? 'Member updated.',
        })
      } else {
        setModalFeedback({
          type: 'success',
          text: options?.successMessage ?? 'Changes saved immediately.',
        })
      }
    } catch (err) {
      setModalFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Could not update member.',
      })
    } finally {
      setModalBusy(false)
    }
  }

  return (
    <div className="dash-members-section">
      {/* 1. Grant Pro by Email (1 Month / Custom Window) */}
      <div className="dash-grant-bar">
        <div className="dash-grant-head">
          <div className="dash-grant-title-row">
            <span className="dash-grant-badge">
              <ZapIcon size={12} />
              <span>Manual Pro Activation</span>
            </span>
            <h3 className="dash-grant-title">Grant Pro Access by Email</h3>
          </div>
          <p className="dash-grant-desc">
            Activate Pro for 1 full month (30 days + 5,000,000 tokens) for any existing member or
            pre-approve an email address before they sign up.
          </p>
        </div>

        <form className="dash-grant-form" onSubmit={(e) => void handleGrantByEmail(e)}>
          <div className="dash-grant-grid">
            <label className="dash-grant-field is-email">
              <span className="dash-grant-label">User Email</span>
              <input
                type="email"
                list="tabula-member-emails"
                className="dash-input"
                placeholder="user@company.com"
                value={grantEmail}
                onChange={(e) => setGrantEmail(e.target.value)}
                required
                disabled={grantSubmitting}
              />
              <datalist id="tabula-member-emails">
                {members
                  .filter((m) => Boolean(m.email) && m.role !== 'admin')
                  .map((m) => (
                    <option key={m.id} value={m.email ?? ''}>
                      {m.display_name ?? m.email}
                    </option>
                  ))}
              </datalist>
            </label>

            <label className="dash-grant-field">
              <span className="dash-grant-label">Plan Tier</span>
              <select
                className="dash-input"
                value={grantTier}
                onChange={(e) =>
                  handleTierChangeForEmailGrant(e.target.value as 'pro' | 'enterprise')
                }
                disabled={grantSubmitting}
              >
                <option value="pro">Pro Analyst (5M tokens)</option>
                <option value="enterprise">Enterprise (25M tokens)</option>
              </select>
            </label>

            <label className="dash-grant-field">
              <span className="dash-grant-label">Duration</span>
              <select
                className="dash-input"
                value={grantDays}
                onChange={(e) => setGrantDays(Number(e.target.value))}
                disabled={grantSubmitting}
              >
                {DURATION_OPTIONS.map((opt) => (
                  <option key={opt.days} value={opt.days}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="dash-grant-field">
              <span className="dash-grant-label">Token Allowance</span>
              <input
                type="number"
                min={0}
                max={100000000}
                step={50000}
                className="dash-input"
                value={grantTokens}
                onChange={(e) => setGrantTokens(Math.max(0, Number(e.target.value) || 0))}
                disabled={grantSubmitting}
              />
            </label>

            <label className="dash-grant-field is-note">
              <span className="dash-grant-label">Note (optional)</span>
              <input
                type="text"
                className="dash-input"
                placeholder="e.g. Manual monthly Pro, Partner, Beta"
                maxLength={140}
                value={grantNote}
                onChange={(e) => setGrantNote(e.target.value)}
                disabled={grantSubmitting}
              />
            </label>

            <div className="dash-grant-submit">
              <button
                type="submit"
                className="dash-btn dash-btn-primary"
                disabled={grantSubmitting || grantEmail.trim().length === 0}
              >
                <ZapIcon size={13} />
                <span>{grantSubmitting ? 'Activating…' : `Grant ${grantDays}d Pro`}</span>
              </button>
            </div>
          </div>

          {grantFeedback ? (
            <p
              className={`dash-field-feedback ${
                grantFeedback.type === 'success' ? 'is-success' : 'is-error'
              }`}
            >
              {grantFeedback.type === 'success' ? (
                <CheckIcon size={13} />
              ) : (
                <AlertIcon size={13} />
              )}
              <span>{grantFeedback.text}</span>
            </p>
          ) : null}
        </form>

        {emailGrants.length > 0 ? (
          <div className="dash-email-grants-box">
            <div className="dash-email-grants-title">
              <span>Active &amp; Pre-Approved Email Grants ({emailGrants.length})</span>
            </div>
            <div className="dash-email-grants-list">
              {emailGrants.slice(0, 8).map((grant) => {
                const win = daysRemainingLabel(grant.expires_at)
                return (
                  <div key={grant.email} className="dash-email-grant-chip">
                    <span className="dash-email-grant-addr">{grant.email}</span>
                    <span className={`dash-plan is-${grant.tier}`}>
                      {PLAN_LABEL[grant.tier] ?? grant.tier}
                    </span>
                    <span className="dash-email-grant-meta">
                      {grant.duration_days}d · {formatCount(grant.tokens_granted)} tok
                    </span>
                    <span
                      className={`dash-email-grant-state ${
                        grant.claimed_at ? 'is-claimed' : 'is-pending'
                      }`}
                    >
                      {grant.claimed_at ? 'Active' : 'Awaiting signup'}
                      {win ? ` · ${win.text}` : ''}
                    </span>
                    <button
                      type="button"
                      className="dash-email-grant-remove"
                      title="Remove grant record"
                      onClick={() => void handleRevokeEmailGrant(grant.email)}
                    >
                      <CloseIcon size={11} />
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        ) : null}
      </div>

      {actionBanner ? (
        <div
          className={`dash-inline-alert ${
            actionBanner.type === 'success' ? 'is-success' : 'is-error'
          }`}
        >
          <span>{actionBanner.text}</span>
          <button
            type="button"
            className="dash-inline-alert-close"
            onClick={() => setActionBanner(null)}
            aria-label="Dismiss message"
          >
            <CloseIcon size={13} />
          </button>
        </div>
      ) : null}

      {loading ? (
        <div className="dash-table-wrap">
          <div className="dash-table-empty">Loading members…</div>
        </div>
      ) : members.length === 0 ? (
        <div className="dash-table-wrap">
          <div className="dash-table-empty">No members yet.</div>
        </div>
      ) : (
        <>
          <div className="dash-table-tools">
            <div className="dash-table-search">
              <SearchIcon size={13} />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by email, name, plan, or status…"
                aria-label="Filter members"
              />
            </div>
            <span className="dash-table-count">
              {formatCount(filtered.length)} of {formatCount(members.length)} members
            </span>
          </div>

          <div className="dash-table-wrap">
            <table className="dash-table">
              <thead>
                <tr>
                  <th scope="col">Member</th>
                  <th scope="col">Plan</th>
                  <th scope="col">Status</th>
                  <th scope="col">Tokens Left</th>
                  <th scope="col">Period Ends</th>
                  <th scope="col">Last Login</th>
                  <th scope="col" style={{ textAlign: 'right' }}>
                    Controls
                  </th>
                </tr>
              </thead>
              <tbody>
                {pagedMembers.map((member) => {
                  const isRowAdmin = member.role === 'admin'
                  const plan = PLAN_LABEL[member.tier ?? 'free'] ?? member.tier ?? 'Free'
                  const win = daysRemainingLabel(member.current_period_end)
                  const effectiveStatusKey = member.is_suspended
                    ? 'suspended'
                    : !isRowAdmin && win?.expired
                      ? 'expired'
                      : (member.subscription_status ?? 'none')
                  const statusLabel =
                    STATUS_LABEL[effectiveStatusKey] ??
                    member.subscription_status ??
                    '—'
                  const isProActive =
                    !member.is_suspended &&
                    (member.tier === 'pro' || member.tier === 'enterprise') &&
                    !win?.expired

                  return (
                    <tr
                      key={member.id}
                      className={member.is_suspended ? 'is-suspended-row' : undefined}
                    >
                      <td className="dash-cell-member">
                        {member.avatar_url ? (
                          <img className="dash-cell-avatar" src={member.avatar_url} alt="" />
                        ) : (
                          <span className="dash-cell-avatar is-fallback" aria-hidden>
                            {(member.display_name ?? member.email ?? '?')
                              .charAt(0)
                              .toUpperCase()}
                          </span>
                        )}
                        <span className="dash-cell-member-text">
                          <span className="dash-cell-name">
                            {member.display_name ?? member.email?.split('@')[0] ?? 'Member'}
                          </span>
                          <span className="dash-cell-email">{member.email}</span>
                        </span>
                        {isRowAdmin ? <span className="dash-role">Admin</span> : null}
                        {member.is_suspended ? (
                          <span className="dash-role is-danger">Suspended</span>
                        ) : null}
                      </td>
                      <td>
                        <span className={`dash-plan is-${member.tier ?? 'free'}`}>{plan}</span>
                      </td>
                      <td className="dash-cell-status">
                        <span className={`dash-status-tag is-${effectiveStatusKey}`}>
                          {statusLabel}
                        </span>
                      </td>
                      <td className="dash-cell-date">
                        {isRowAdmin ? (
                          <span className="dash-tokens-unlimited">Unlimited</span>
                        ) : (
                          <span className="dash-tokens-count">
                            {formatCount(member.tokens_remaining ?? 0)}
                          </span>
                        )}
                      </td>
                      <td className="dash-cell-date">
                        {isRowAdmin ? (
                          '—'
                        ) : (
                          <div className="dash-period-cell">
                            <span>{formatDate(member.current_period_end)}</span>
                            {win ? (
                              <span
                                className={`dash-days-pill ${
                                  win.expired ? 'is-expired' : 'is-active'
                                }`}
                              >
                                {win.text}
                              </span>
                            ) : null}
                          </div>
                        )}
                      </td>
                      <td className="dash-cell-date" title={formatDate(member.last_sign_in_at)}>
                        {relativeTime(member.last_sign_in_at)}
                      </td>
                      <td className="dash-cell-actions">
                        <div className="dash-row-actions">
                          {!isRowAdmin && !isProActive ? (
                            <button
                              type="button"
                              className="dash-row-btn is-pro-grant"
                              disabled={busyMemberId === member.id}
                              onClick={() => void handleQuickMakePro(member)}
                              title="Activate Pro for 1 full month (30 days + 5,000,000 tokens)"
                            >
                              <ZapIcon size={11} />
                              <span>
                                {busyMemberId === member.id ? 'Saving…' : 'Make Pro (1 Mo)'}
                              </span>
                            </button>
                          ) : null}
                          <button
                            type="button"
                            className="dash-row-btn"
                            onClick={() => setSelectedMemberId(member.id)}
                          >
                            <SettingsIcon size={12} />
                            <span>Manage</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <Pagination
            page={safePage}
            pageSize={pageSize}
            totalItems={filtered.length}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            pageSizeOptions={[10, 25, 50]}
            itemLabel="members"
          />
        </>
      )}

      {/* 3. Member Security & Plan Control Modal (Portaled to document.body) */}
      {selectedMember
        ? createPortal(
            <div
              className="dash-modal-backdrop"
              role="presentation"
              onMouseDown={() => !modalBusy && setSelectedMemberId(null)}
            >
          <div
            className="dash-member-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="dash-member-modal-title"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <header className="dash-member-modal-head">
              <div className="dash-member-modal-user">
                <span className="dash-cell-avatar is-fallback">
                  {(selectedMember.display_name ?? selectedMember.email ?? '?')
                    .charAt(0)
                    .toUpperCase()}
                </span>
                <div>
                  <h3 id="dash-member-modal-title" className="dash-member-modal-title">
                    {selectedMember.display_name ?? selectedMember.email}
                  </h3>
                  <p className="dash-member-modal-sub">
                    {selectedMember.email} ·{' '}
                    <strong>
                      {PLAN_LABEL[selectedMember.tier ?? 'free'] ?? selectedMember.tier}
                    </strong>
                    {selectedMember.role === 'admin' ? ' · Administrator' : ''}
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="dash-modal-close"
                onClick={() => setSelectedMemberId(null)}
                disabled={modalBusy}
                aria-label="Close member controls"
              >
                <CloseIcon size={15} />
              </button>
            </header>

            <div className="dash-member-modal-body">
              {/* Summary Strip */}
              <div className="dash-member-summary-grid">
                <div className="dash-member-stat">
                  <span className="dash-member-stat-label">Current Plan</span>
                  <strong className="dash-member-stat-val">
                    {PLAN_LABEL[selectedMember.tier ?? 'free'] ?? 'Free'}
                  </strong>
                </div>
                <div className="dash-member-stat">
                  <span className="dash-member-stat-label">Access Status</span>
                  <strong className="dash-member-stat-val">
                    {selectedMember.is_suspended
                      ? 'Suspended'
                      : (STATUS_LABEL[selectedMember.subscription_status ?? ''] ?? 'Active')}
                  </strong>
                </div>
                <div className="dash-member-stat">
                  <span className="dash-member-stat-label">Remaining Tokens</span>
                  <strong className="dash-member-stat-val">
                    {selectedMember.role === 'admin'
                      ? 'Unlimited'
                      : formatCount(selectedMember.tokens_remaining ?? 0)}
                  </strong>
                </div>
                <div className="dash-member-stat">
                  <span className="dash-member-stat-label">Period Ends</span>
                  <strong className="dash-member-stat-val">
                    {formatDate(selectedMember.current_period_end)}
                  </strong>
                </div>
              </div>

              {modalFeedback ? (
                <p
                  className={`dash-field-feedback ${
                    modalFeedback.type === 'success' ? 'is-success' : 'is-error'
                  }`}
                >
                  {modalFeedback.type === 'success' ? (
                    <CheckIcon size={13} />
                  ) : (
                    <AlertIcon size={13} />
                  )}
                  <span>{modalFeedback.text}</span>
                </p>
              ) : null}

              {/* Section A: Pro & Subscription Controls */}
              <div className="dash-control-group">
                <div className="dash-control-head">
                  <span className="dash-control-title">Plan &amp; Monthly Pro Access</span>
                  <select
                    className="dash-input dash-input-sm"
                    value={customDaysInput}
                    onChange={(e) => setCustomDaysInput(Number(e.target.value))}
                    disabled={modalBusy}
                    aria-label="Grant duration"
                  >
                    {DURATION_OPTIONS.map((opt) => (
                      <option key={opt.days} value={opt.days}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="dash-control-actions">
                  <button
                    type="button"
                    className="dash-btn dash-btn-primary dash-btn-sm"
                    disabled={modalBusy}
                    onClick={() =>
                      void handleModalAction('grant_pro_month', {
                        tier: 'pro',
                        days: customDaysInput,
                        tokens: 5_000_000,
                        successMessage: `Granted Pro Analyst for ${customDaysInput} days with 5,000,000 tokens.`,
                      })
                    }
                  >
                    <ZapIcon size={12} />
                    <span>Make Pro ({customDaysInput}d · 5M tokens)</span>
                  </button>

                  <button
                    type="button"
                    className="dash-btn dash-btn-secondary dash-btn-sm"
                    disabled={modalBusy}
                    onClick={() =>
                      void handleModalAction('grant_enterprise_month', {
                        tier: 'enterprise',
                        days: customDaysInput,
                        tokens: 25_000_000,
                        successMessage: `Granted Enterprise for ${customDaysInput} days with 25,000,000 tokens.`,
                      })
                    }
                  >
                    <span>Make Enterprise ({customDaysInput}d · 25M)</span>
                  </button>

                  <button
                    type="button"
                    className="dash-btn dash-btn-secondary dash-btn-sm"
                    disabled={modalBusy}
                    onClick={() =>
                      void handleModalAction('extend_period', {
                        days: 30,
                        successMessage: 'Extended current subscription period by +30 days.',
                      })
                    }
                  >
                    <span>Extend +30 Days</span>
                  </button>

                  <button
                    type="button"
                    className="dash-btn dash-btn-ghost dash-btn-sm"
                    disabled={modalBusy}
                    onClick={() =>
                      void handleModalAction('reset_trial', {
                        tokens: 250_000,
                        successMessage: 'Reset to a fresh 7-day free trial (250,000 tokens).',
                      })
                    }
                  >
                    <span>Reset 7-Day Trial</span>
                  </button>

                  {selectedMember.role !== 'admin' && selectedMember.tier !== 'free' ? (
                    <button
                      type="button"
                      className="dash-btn dash-btn-ghost dash-btn-sm"
                      disabled={modalBusy}
                      onClick={() =>
                        void handleModalAction('downgrade_free', {
                          successMessage: 'Removed Pro access and downgraded account back to Free.',
                        })
                      }
                    >
                      <span>Remove Pro (Downgrade to Free)</span>
                    </button>
                  ) : null}
                </div>
              </div>

              {/* Section B: Token Balance Override */}
              <div className="dash-control-group">
                <span className="dash-control-title">Token Quota Control</span>
                <div className="dash-token-presets">
                  {TOKEN_PRESETS.map((preset) => (
                    <button
                      key={preset.value}
                      type="button"
                      className={`dash-exit-chip ${
                        Number(customTokensInput) === preset.value ? 'is-active' : ''
                      }`}
                      disabled={modalBusy}
                      onClick={() => setCustomTokensInput(String(preset.value))}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                <div className="dash-input-row">
                  <input
                    type="number"
                    min={0}
                    max={100000000}
                    step={10000}
                    className="dash-input"
                    value={customTokensInput}
                    onChange={(e) => setCustomTokensInput(e.target.value)}
                    disabled={modalBusy}
                  />
                  <button
                    type="button"
                    className="dash-btn dash-btn-secondary dash-btn-input"
                    disabled={modalBusy}
                    onClick={() => {
                      const parsed = Math.max(0, Math.round(Number(customTokensInput) || 0))
                      void handleModalAction('set_tokens', {
                        tokens: parsed,
                        successMessage: `Token balance updated to ${formatCount(parsed)} tokens.`,
                      })
                    }}
                  >
                    Set Tokens
                  </button>
                </div>
              </div>

              {/* Section C: Security & Account Restrictions */}
              {selectedMember.role === 'admin' || selectedMember.id === currentUser?.id ? (
                <div className="dash-control-group is-protected">
                  <div className="dash-security-badge">
                    <ShieldCheckIcon size={14} />
                    <span>Protected Administrator Account</span>
                  </div>
                  <p className="dash-pref-hint">
                    Administrator accounts are hardware-locked against suspension, downgrade, or
                    deletion to prevent accidental lockout.
                  </p>
                </div>
              ) : (
                <div className="dash-control-group is-security">
                  <span className="dash-control-title">Security &amp; Access Restriction</span>

                  {selectedMember.is_suspended ? (
                    <div className="dash-suspended-box">
                      <p className="dash-suspended-note">
                        <LockIcon size={13} />
                        <span>
                          Account is currently suspended
                          {selectedMember.suspended_reason
                            ? `: “${selectedMember.suspended_reason}”`
                            : '.'}
                        </span>
                      </p>
                      <button
                        type="button"
                        className="dash-btn dash-btn-primary dash-btn-sm"
                        disabled={modalBusy}
                        onClick={() =>
                          void handleModalAction('unsuspend', {
                            successMessage: 'Account unsuspended and access restored.',
                          })
                        }
                      >
                        Restore Access (Unsuspend)
                      </button>
                    </div>
                  ) : (
                    <div className="dash-input-row">
                      <input
                        type="text"
                        className="dash-input"
                        placeholder="Reason for suspension (optional, e.g. Abuse / Payment pending)"
                        value={suspendReasonInput}
                        onChange={(e) => setSuspendReasonInput(e.target.value)}
                        maxLength={200}
                        disabled={modalBusy}
                      />
                      <button
                        type="button"
                        className="dash-btn dash-btn-danger-outline dash-btn-input"
                        disabled={modalBusy}
                        onClick={() =>
                          void handleModalAction('suspend', {
                            reason: suspendReasonInput,
                            successMessage:
                              'Account suspended. All AI queries are now blocked for this user.',
                          })
                        }
                      >
                        <LockIcon size={12} />
                        <span>Suspend User</span>
                      </button>
                    </div>
                  )}

                  <div className="dash-divider" style={{ margin: '10px 0' }} />

                  {!confirmRemoveUser ? (
                    <div className="dash-pref-row">
                      <div>
                        <span className="dash-label" style={{ color: 'var(--danger)' }}>
                          Remove User Account
                        </span>
                        <p className="dash-pref-hint">
                          Permanently delete this user and revoke all sessions.
                        </p>
                      </div>
                      <button
                        type="button"
                        className="dash-btn dash-btn-danger-outline dash-btn-sm"
                        disabled={modalBusy}
                        onClick={() => setConfirmRemoveUser(true)}
                      >
                        <TrashIcon size={12} />
                        <span>Delete User</span>
                      </button>
                    </div>
                  ) : (
                    <div className="dash-confirm-box">
                      <p className="dash-confirm-text">
                        <AlertIcon size={14} />
                        <span>
                          Permanently delete{' '}
                          <strong>{selectedMember.email ?? selectedMember.display_name}</strong>?
                          This action cannot be undone.
                        </span>
                      </p>
                      <div className="dash-confirm-actions">
                        <button
                          type="button"
                          className="dash-btn dash-btn-danger dash-btn-sm"
                          disabled={modalBusy}
                          onClick={() =>
                            void handleModalAction('delete_user', {
                              reason: suspendReasonInput || 'Removed by administrator',
                              successMessage: `Deleted account ${selectedMember.email}.`,
                              closeAfter: true,
                            })
                          }
                        >
                          <TrashIcon size={12} />
                          <span>{modalBusy ? 'Deleting…' : 'Confirm Permanent Delete'}</span>
                        </button>
                        <button
                          type="button"
                          className="dash-btn dash-btn-ghost dash-btn-sm"
                          disabled={modalBusy}
                          onClick={() => setConfirmRemoveUser(false)}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>,
            document.body,
          )
        : null}
    </div>
  )
}
