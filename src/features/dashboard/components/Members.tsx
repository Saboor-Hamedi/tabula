import { useEffect, useMemo, useState } from 'react'
import { formatCount } from '../../../core/utils/format'
import { SearchIcon } from '../../common/Icons'
import { Pagination } from '../../common/Pagination'
import type { Member } from '../api'

/**
 * The member list.
 *
 * A table, not a grid of cards: an administrator is comparing rows, and rows
 * are what compare. The subscription window is the column that matters, so it
 * gets the width.
 */

export interface MembersProps {
  members: Member[]
  loading?: boolean
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
}

export function Members({ members, loading = false }: MembersProps) {
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase()
    if (!term) return members
    return members.filter((member) =>
      [member.email, member.display_name, member.tier, member.role]
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

  if (loading) {
    return (
      <div className="dash-table-wrap">
        <div className="dash-table-empty">Loading members…</div>
      </div>
    )
  }

  if (members.length === 0) {
    return (
      <div className="dash-table-wrap">
        <div className="dash-table-empty">No members yet.</div>
      </div>
    )
  }

  return (
    <div className="dash-table-wrap">
      <div className="dash-table-tools">
        <div className="dash-table-search">
          <SearchIcon size={14} />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter members"
            aria-label="Filter members"
          />
        </div>
        <span className="dash-table-count">
          {formatCount(filtered.length)} of {formatCount(members.length)}
        </span>
      </div>

      <table className="dash-table">
        <thead>
          <tr>
            <th scope="col">Member</th>
            <th scope="col">Plan</th>
            <th scope="col">Status</th>
            <th scope="col">Started</th>
            <th scope="col">Ends</th>
            <th scope="col">Last login</th>
          </tr>
        </thead>
        <tbody>
          {pagedMembers.map((member) => {
            const plan = PLAN_LABEL[member.tier ?? 'free'] ?? member.tier ?? 'Free'
            const status = member.subscription_status
              ? (STATUS_LABEL[member.subscription_status] ?? member.subscription_status)
              : '—'
            return (
              <tr key={member.id}>
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
                  {member.role === 'admin' ? (
                    <span className="dash-role">Admin</span>
                  ) : null}
                </td>
                <td>
                  <span className={`dash-plan is-${member.tier ?? 'free'}`}>{plan}</span>
                </td>
                <td className="dash-cell-status">{status}</td>
                <td className="dash-cell-date">{formatDate(member.current_period_start)}</td>
                <td className="dash-cell-date">
                  {formatDate(member.current_period_end)}
                  {member.cancel_at_period_end ? (
                    <span className="dash-flag">Cancels</span>
                  ) : null}
                </td>
                <td className="dash-cell-date" title={formatDate(member.last_sign_in_at)}>
                  {relativeTime(member.last_sign_in_at)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <Pagination
        page={safePage}
        pageSize={pageSize}
        totalItems={filtered.length}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        pageSizeOptions={[10, 25, 50]}
        itemLabel="members"
      />
    </div>
  )
}
