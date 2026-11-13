import { useEffect, useMemo, useState } from 'react'
import { useRouter } from '../../../core/router'
import { userPath } from '../../../core/router/paths'
import { loadPersistedWorkspace } from '../../../core/storage/persistence'
import { formatCount } from '../../../core/utils/format'
import { isSupabaseConfigured } from '../../../core/supabase/client'
import { openPricingModal, useUsageStatus } from '../../../core/supabase/usage'
import { useAuthUser, useIsAdmin, useProfile, useUserSlug } from '../../auth/useProfile'
import { useDisplayName } from '../../auth/display'
import { Header } from '../../header/Header'
import {
  ArrowLeftIcon,
  BarChartIcon,
  DatabaseIcon,
  GlobeIcon,
  LockIcon,
  ZapIcon,
} from '../../common/Icons'
import { Identity } from '../components/Identity'
import { Insights } from '../components/Insights'
import { Members } from '../components/Members'
import { Metric } from '../components/Metric'
import { listMembers, type Member } from '../api'

/**
 * Analyse — the signed-in home.
 *
 * A member sees their identity and their own activity. An administrator
 * additionally sees the member list with their subscription windows, and
 * the controls over everything published.
 *
 * Every state is honest: no account, no profile row, no project and a failed
 * query each get their own message rather than an empty screen.
 */

interface WorkspaceStats {
  datasets: number
  questions: number
  rows: number
}

/** True when the project has not had the administrator policies applied. */
function isMissingSchema(message: string): boolean {
  return /does not exist|schema cache|not found|PGRST/i.test(message)
}

export function Analyse() {
  const { navigate } = useRouter()
  const user = useAuthUser()
  const profile = useProfile()
  const isAdmin = useIsAdmin()
  const userSlug = useUserSlug()
  const displayName = useDisplayName()

  const [stats, setStats] = useState<WorkspaceStats | null>(null)
  const { usage } = useUsageStatus()
  const [members, setMembers] = useState<Member[]>([])
  const [membersLoading, setMembersLoading] = useState(false)
  const [adminError, setAdminError] = useState<string | null>(null)
  const [schemaMissing, setSchemaMissing] = useState(false)

  useEffect(() => {
    let active = true

    const loadStats = async () => {
      try {
        const workspace = await loadPersistedWorkspace()
        if (!active) return
        setStats({
          datasets: workspace.sessions.length,
          questions: workspace.sessions.reduce(
            (total, record) => total + (record.messages?.length ?? 0),
            0,
          ),
          rows: workspace.sessions.reduce((total, record) => {
            const table = record.session?.tables?.[0]
            return total + (table?.rowCount ?? 0)
          }, 0),
        })
      } catch {
        if (active) setStats({ datasets: 0, questions: 0, rows: 0 })
      }
    }

    void loadStats()
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!isAdmin) return
    let active = true

    const loadAdmin = async () => {
      setMembersLoading(true)
      try {
        const rows = await listMembers()
        if (!active) return
        setMembers(rows)
        setAdminError(null)
        setSchemaMissing(false)
      } catch (loadError) {
        if (!active) return
        const message =
          loadError instanceof Error ? loadError.message : 'The member list could not be loaded.'
        setAdminError(message)
        setSchemaMissing(isMissingSchema(message))
      } finally {
        if (active) setMembersLoading(false)
      }
    }

    void loadAdmin()
    return () => {
      active = false
    }
  }, [isAdmin])

  const overview = useMemo(() => {
    const subscribers = members.filter(
      (member) =>
        member.subscription_status === 'active' &&
        (member.tier === 'pro' || member.tier === 'enterprise'),
    ).length
    const admins = members.filter((member) => member.role === 'admin').length
    return { users: members.length, admins, subscribers }
  }, [members])

  const degraded = Boolean(user) && !profile
  const quotaExhausted = Boolean(
    usage &&
      !usage.isAdmin &&
      usage.monthlyLimit !== null &&
      usage.remainingTokens !== null &&
      usage.remainingTokens <= 0,
  )

  return (
    <div className="shell-frame">
      <Header variant="dashboard" />

      <main className="dash-page">
        <header className="dash-hero">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <span className="dash-eyebrow">Dashboard</span>
            <button
              type="button"
              className="btn btn-ghost btn-small"
              onClick={() => navigate(userPath('/workspace', userSlug))}
            >
              <ArrowLeftIcon size={13} />
              <span>Back to Workspace</span>
            </button>
          </div>
          <h1 className="dash-title">
            {user ? `Welcome back, ${displayName.split(' ')[0]}` : 'Analyse your data'}
          </h1>
          <p className="dash-subtitle">
            {isAdmin
              ? 'Manage members, subscriptions, and all published posts in one place.'
              : 'Your datasets and your activity on Lumina Tabula.'}
          </p>
        </header>

        {!isSupabaseConfigured ? (
          <div className="dash-notice">
            <LockIcon size={14} />
            <span>
              No project is configured, so accounts and publishing are unavailable. The workspace
              still runs entirely on this device.
            </span>
          </div>
        ) : null}

        <div className="dash-top">
          <Identity
            name={displayName}
            email={user?.email ?? profile?.email ?? null}
            avatarUrl={profile?.avatar_url ?? user?.user_metadata?.avatar_url ?? null}
            role={profile?.role ?? null}
            tier={profile?.tier ?? null}
            degraded={degraded}
          />

          <div className="dash-metrics">
            {isAdmin ? (
              <>
                <Metric
                  label="Members"
                  value={formatCount(overview.users)}
                  hint={`${overview.admins} admin${overview.admins === 1 ? '' : 's'}`}
                  icon={<DatabaseIcon size={14} />}
                />
                <Metric
                  label="Subscribers"
                  value={formatCount(overview.subscribers)}
                  icon={<BarChartIcon size={14} />}
                />
                <Metric
                  label="Your datasets"
                  value={formatCount(stats?.datasets ?? 0)}
                  icon={<ZapIcon size={14} />}
                />
                <Metric
                  label="Questions asked"
                  value={formatCount(stats?.questions ?? 0)}
                  icon={<BarChartIcon size={14} />}
                />
              </>
            ) : (
              <>
                <Metric
                  label="Datasets analysed"
                  value={formatCount(stats?.datasets ?? 0)}
                  icon={<DatabaseIcon size={14} />}
                />
                <Metric
                  label="Questions asked"
                  value={formatCount(stats?.questions ?? 0)}
                  icon={<ZapIcon size={14} />}
                />
                <Metric
                  label="Tokens spent"
                  value={formatCount(usage?.usedTokens ?? 0)}
                  hint={
                    usage
                      ? usage.monthlyLimit !== null
                        ? `${formatCount(usage.monthlyLimit)} monthly limit · ${formatCount(usage.remainingTokens ?? 0)} left`
                        : 'Unlimited monthly quota'
                      : undefined
                  }
                  icon={<ZapIcon size={14} />}
                />
                <Metric
                  label="Plan"
                  value={
                    usage?.trialExpired
                      ? 'Trial ended'
                      : quotaExhausted
                        ? 'Tokens finished'
                        : usage?.status === 'trialing' && usage?.tier === 'free'
                          ? `Trial (${usage.trialDaysRemaining ?? 0}d left)`
                          : (profile?.tier ?? 'free')
                  }
                  hint={
                    usage
                      ? `${formatCount(usage.inputTokens)} in · ${formatCount(usage.outputTokens)} out`
                      : undefined
                  }
                  icon={<GlobeIcon size={14} />}
                />
              </>
            )}
          </div>
        </div>

        {!isAdmin && usage && (usage.trialExpired || quotaExhausted || usage.tier === 'free') ? (
          <div className="dash-notice" style={{ justifyContent: 'space-between', marginBottom: 16 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <LockIcon size={14} />
              <span>
                {usage.trialExpired
                  ? 'Your 7-day free trial has ended. Upgrade with Stripe to resume uploading data and asking Lumina Tabula.'
                  : quotaExhausted
                    ? `You have finished your trial tokens (${formatCount(usage.usedTokens)} / ${formatCount(usage.monthlyLimit ?? 250000)} tokens used). Upgrade to Lumina Tabula Pro to continue.`
                    : `You have ${usage.trialDaysRemaining ?? 0} day${usage.trialDaysRemaining === 1 ? '' : 's'} left in your free trial (${formatCount(usage.usedTokens)} / ${formatCount(usage.monthlyLimit ?? 250000)} tokens used).`}
              </span>
            </span>
            <button
              type="button"
              className="btn btn-primary btn-small"
              onClick={() =>
                openPricingModal(
                  usage.trialExpired
                    ? 'trial-expired'
                    : quotaExhausted
                      ? 'quota-exceeded'
                      : 'upgrade',
                )
              }
            >
              {usage.trialExpired || quotaExhausted ? 'Pay with Stripe' : 'Upgrade to Pro'}
            </button>
          </div>
        ) : null}

        {isAdmin ? (
          <>
            <section className="dash-panel">
              <header className="dash-panel-head">
                <h2 className="dash-section-title">Members</h2>
                <span className="dash-panel-note">
                  Sign-ins and subscription windows, straight from the database.
                </span>
              </header>
              {adminError ? (
                <p className="publish-error">
                  {adminError}
                  {schemaMissing
                    ? ' Apply features/migration/migration.sql to your project to enable it.'
                    : ''}
                </p>
              ) : null}
              <Members members={members} loading={membersLoading} />
            </section>

            <Insights />
          </>
        ) : null}
      </main>
    </div>
  )
}
