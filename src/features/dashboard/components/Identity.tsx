import { useProfile } from '../../auth/useProfile'

/**
 * The account identity.
 *
 * The name, the address and the role. The account identifier is deliberately
 * not shown: it belongs to the database, not to the interface.
 */

export interface IdentityProps {
  name: string
  email: string | null
  avatarUrl: string | null
  role?: 'user' | 'admin' | null
  tier?: string | null
  /** True when the profile row could not be read. */
  degraded?: boolean
}

export function Identity({
  name,
  email,
  avatarUrl,
  role = null,
  tier = null,
  degraded = false,
}: IdentityProps) {
  const profile = useProfile()
  const initial = name.trim().length > 0 ? name.trim().slice(0, 1).toUpperCase() : '?'
  const resolvedAvatar = avatarUrl ?? profile?.avatar_url ?? null

  return (
    <section className="dash-identity">
      <div className="dash-identity-head">
        {resolvedAvatar ? (
          <img className="dash-avatar" src={resolvedAvatar} alt="" />
        ) : (
          <span className="dash-avatar is-fallback" aria-hidden>
            {initial}
          </span>
        )}

        <div className="dash-identity-text">
          <h2 className="dash-identity-name">{name}</h2>
          {email ? <p className="dash-identity-email">{email}</p> : null}
          <div className="dash-badges">
            {role ? (
              <span className={`dash-badge ${role === 'admin' ? 'is-admin' : ''}`}>
                {role === 'admin' ? 'Administrator' : 'Member'}
              </span>
            ) : null}
            {tier ? <span className="dash-badge">{tier}</span> : null}
            {degraded ? (
              <span className="dash-badge is-warn">Profile unavailable</span>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  )
}
