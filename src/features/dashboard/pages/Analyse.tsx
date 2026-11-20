import { useEffect, useMemo, useState } from 'react'
import { useQuery, useRouter } from '../../../core/router'
import { ROUTES, userPath } from '../../../core/router/paths'
import {
  loadPersistedWorkspace,
  saveActiveSessionId,
} from '../../../core/storage/persistence'
import { formatCount } from '../../../core/utils/format'
import { isSupabaseConfigured } from '../../../core/supabase/client'
import { deleteMyAccount, updateDisplayName } from '../../../core/supabase/deleteAccount'
import { openPricingModal, useUsageStatus } from '../../../core/supabase/usage'
import { useAuthUser, useIsAdmin, useProfile, useUserSlug } from '../../auth/useProfile'
import { useDisplayName } from '../../auth/display'
import { Header } from '../../header/Header'
import {
  ActivityIcon,
  AlertIcon,
  ArrowRightIcon,
  BarChartIcon,
  CheckIcon,
  CloseIcon,
  DatabaseIcon,
  FileIcon,
  GlobeIcon,
  LockIcon,
  MoonIcon,
  SearchIcon,
  SettingsIcon,
  SheetIcon,
  ShieldCheckIcon,
  SunIcon,
  TrashIcon,
  UserIcon,
  ZapIcon,
} from '../../common/Icons'
import { Insights } from '../components/Insights'
import { Members } from '../components/Members'
import { Metric } from '../components/Metric'
import { ResearchSources, type ReadyDatasetFile } from '../../sources'
import {
  listAdminAuditLogs,
  listDeletedAccounts,
  listEmailGrants,
  listMembers,
  type AdminAuditLogEntry,
  type DeletedAccountEntry,
  type EmailGrantEntry,
  type Member,
} from '../api'

const EXIT_REASONS = [
  'Just testing',
  'Too expensive',
  'Missing a feature',
  'Found another tool',
  'Other',
] as const

/**
 * Analyse — Unified Sidebar Dashboard for Admins & Members.
 *
 * - Unified left sidebar on desktop + clean horizontal nav bar on phones/tablets
 * - Admins get dedicated Overview, Members, Published Stories, and Account & Security tabs
 * - Administrator accounts are strictly protected from self-deletion (both UI & DB)
 */

type DashSection = 'overview' | 'sources' | 'members' | 'stories' | 'account'
type MemberFilter = 'all' | 'subscribers' | 'trialing' | 'suspended' | 'admins'

interface LocalDatasetItem {
  id: string
  name: string
  rows: number
  questions: number
  updatedAt: number
}

interface WorkspaceStats {
  datasets: number
  questions: number
  rows: number
  items: LocalDatasetItem[]
}

function isMissingSchema(message: string): boolean {
  return /does not exist|schema cache|not found|PGRST/i.test(message)
}

function readInitialTheme(): 'light' | 'dark' {
  if (typeof document === 'undefined') return 'light'
  const attr = document.documentElement.getAttribute('data-theme')
  if (attr === 'dark' || attr === 'light') return attr
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function Analyse() {
  const { navigate } = useRouter()
  const user = useAuthUser()
  const profile = useProfile()
  const isAdmin = useIsAdmin()
  const userSlug = useUserSlug()
  const displayName = useDisplayName()
  const query = useQuery()
  const urlSection = query.get('section') as DashSection | null

  const [section, setSection] = useState<DashSection>(() => {
    if (
      urlSection &&
      ['overview', 'sources', 'members', 'stories', 'account'].includes(urlSection)
    ) {
      return urlSection
    }
    return 'overview'
  })

  useEffect(() => {
    if (
      urlSection &&
      ['overview', 'sources', 'members', 'stories', 'account'].includes(urlSection)
    ) {
      setSection(urlSection)
    }
  }, [urlSection])
  const [memberFilter, setMemberFilter] = useState<MemberFilter>('all')
  const [stats, setStats] = useState<WorkspaceStats | null>(null)
  const { usage } = useUsageStatus()
  const [members, setMembers] = useState<Member[]>([])
  const [deletedAccounts, setDeletedAccounts] = useState<DeletedAccountEntry[]>([])
  const [emailGrants, setEmailGrants] = useState<EmailGrantEntry[]>([])
  const [auditLogs, setAuditLogs] = useState<AdminAuditLogEntry[]>([])
  const [membersLoading, setMembersLoading] = useState(false)
  const [adminError, setAdminError] = useState<string | null>(null)
  const [schemaMissing, setSchemaMissing] = useState(false)

  // Interactive inputs
  const [datasetQuery, setDatasetQuery] = useState('')
  const [nameInput, setNameInput] = useState(displayName)
  const [nameSaving, setNameSaving] = useState(false)
  const [nameSaved, setNameSaved] = useState(false)
  const [nameError, setNameError] = useState<string | null>(null)
  const [theme, setTheme] = useState<'light' | 'dark'>(readInitialTheme)
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true
    try {
      const saved = localStorage.getItem('tabula:dash-sidebar')
      if (window.innerWidth <= 786) {
        return saved === 'open'
      }
      return saved !== 'closed'
    } catch {
      return typeof window !== 'undefined' ? window.innerWidth > 786 : true
    }
  })

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia('(max-width: 786px)')
    const handleMedia = (e: MediaQueryListEvent) => {
      if (e.matches) {
        setSidebarOpen(false)
      }
    }
    if (mq.addEventListener) {
      mq.addEventListener('change', handleMedia)
      return () => mq.removeEventListener('change', handleMedia)
    }
  }, [])

  const handleToggleSidebar = () => {
    setSidebarOpen((prev) => {
      const next = !prev
      try {
        localStorage.setItem('tabula:dash-sidebar', next ? 'open' : 'closed')
      } catch {}
      return next
    })
  }

  const handleSelectSection = (next: DashSection) => {
    if (!isAdmin && (next === 'members' || next === 'stories')) {
      setSection('overview')
      return
    }
    setSection(next)
    if (typeof window !== 'undefined' && window.innerWidth <= 786) {
      setSidebarOpen(false)
    }
  }

  // Non-admin self-service account deletion state (with optional feedback)
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const [deleteReason, setDeleteReason] = useState<string>('')
  const [deleteNote, setDeleteNote] = useState<string>('')
  const [deletingAccount, setDeletingAccount] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  useEffect(() => {
    setNameInput(displayName)
  }, [displayName])

  // Ensure non-admins cannot land on admin-only tabs
  useEffect(() => {
    if (!isAdmin && (section === 'members' || section === 'stories')) {
      setSection('overview')
    }
  }, [isAdmin, section])

  useEffect(() => {
    let active = true

    const loadStats = async () => {
      try {
        const workspace = await loadPersistedWorkspace(user?.id ?? null)
        if (!active) return
        const items: LocalDatasetItem[] = workspace.sessions
          .map((record) => {
            const table = record.session?.tables?.[0]
            return {
              id: record.session.id,
              name: record.session.fileName || table?.name || 'Untitled workbook',
              rows: table?.rowCount ?? 0,
              questions: record.messages?.length ?? 0,
              updatedAt: record.session.uploadedAt ?? 0,
            }
          })
          .sort((a, b) => b.updatedAt - a.updatedAt)

        setStats({
          datasets: items.length,
          questions: items.reduce((sum, item) => sum + item.questions, 0),
          rows: items.reduce((sum, item) => sum + item.rows, 0),
          items,
        })
      } catch {
        if (active) setStats({ datasets: 0, questions: 0, rows: 0, items: [] })
      }
    }

    void loadStats()
    return () => {
      active = false
    }
  }, [user?.id])

  const refreshAdminData = async (showSpinner = false) => {
    if (!isAdmin) return
    if (showSpinner) setMembersLoading(true)
    try {
      const [rows, deletions, grants, logs] = await Promise.all([
        listMembers(),
        listDeletedAccounts(),
        listEmailGrants(),
        listAdminAuditLogs(),
      ])
      setMembers(rows)
      setDeletedAccounts(deletions)
      setEmailGrants(grants)
      setAuditLogs(logs)
      setAdminError(null)
      setSchemaMissing(false)
    } catch (loadError) {
      const message =
        loadError instanceof Error ? loadError.message : 'The member list could not be loaded.'
      setAdminError(message)
      setSchemaMissing(isMissingSchema(message))
    } finally {
      if (showSpinner) setMembersLoading(false)
    }
  }

  useEffect(() => {
    if (!isAdmin) return
    void refreshAdminData(true)
  }, [isAdmin])

  const overview = useMemo(() => {
    if (!isAdmin) return { users: 0, admins: 0, subscribers: 0, trialing: 0, suspended: 0 }
    const subscribers = members.filter(
      (m) =>
        !m.is_suspended &&
        m.subscription_status === 'active' &&
        (m.tier === 'pro' || m.tier === 'enterprise'),
    ).length
    const trialing = members.filter(
      (m) => !m.is_suspended && m.subscription_status === 'trialing',
    ).length
    const suspended = members.filter((m) => m.is_suspended).length
    const admins = members.filter((m) => m.role === 'admin').length
    return { users: members.length, admins, subscribers, trialing, suspended }
  }, [members, isAdmin])

  const filteredDatasets = useMemo(() => {
    const list = stats?.items ?? []
    const term = datasetQuery.trim().toLowerCase()
    if (!term) return list
    return list.filter((item) => item.name.toLowerCase().includes(term))
  }, [stats?.items, datasetQuery])

  const filteredMembers = useMemo(() => {
    if (memberFilter === 'subscribers') {
      return members.filter(
        (m) =>
          !m.is_suspended &&
          m.subscription_status === 'active' &&
          (m.tier === 'pro' || m.tier === 'enterprise'),
      )
    }
    if (memberFilter === 'trialing') {
      return members.filter((m) => !m.is_suspended && m.subscription_status === 'trialing')
    }
    if (memberFilter === 'suspended') {
      return members.filter((m) => m.is_suspended)
    }
    if (memberFilter === 'admins') {
      return members.filter((m) => m.role === 'admin')
    }
    return members
  }, [members, memberFilter])

  const quotaExhausted = Boolean(
    usage &&
      !usage.isAdmin &&
      usage.monthlyLimit !== null &&
      usage.remainingTokens !== null &&
      usage.remainingTokens <= 0,
  )

  const usagePct = useMemo(() => {
    if (!usage || usage.monthlyLimit === null || usage.monthlyLimit <= 0) return 0
    return Math.min(100, Math.round((usage.usedTokens / usage.monthlyLimit) * 100))
  }, [usage])

  const applyTheme = (next: 'light' | 'dark') => {
    setTheme(next)
    document.documentElement.setAttribute('data-theme', next)
    try {
      localStorage.setItem('tabula-theme', next)
    } catch {
      // ignore storage failures
    }
  }

  const handleOpenDataset = async (sessionId?: string) => {
    if (sessionId) {
      try {
        await saveActiveSessionId(sessionId, user?.id ?? null)
      } catch {
        // ignore persistence error
      }
    }
    navigate(userPath('/workspace', userSlug))
  }

  const handleLoadSampleDataset = async (file: ReadyDatasetFile) => {
    try {
      sessionStorage.setItem('tabula:pending-sample', `${file.fileUrl}::${file.fileName}`)
      navigate(userPath('/workspace', userSlug))
    } catch {
      window.open(file.fileUrl, '_blank')
    }
  }

  const handleSaveName = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!user?.id) return
    setNameSaving(true)
    setNameError(null)
    setNameSaved(false)
    try {
      const updated = await updateDisplayName(user.id, nameInput)
      setNameInput(updated)
      setNameSaved(true)
      window.setTimeout(() => setNameSaved(false), 2600)
    } catch (err) {
      setNameError(err instanceof Error ? err.message : 'Could not save display name.')
    } finally {
      setNameSaving(false)
    }
  }

  const handleDeleteAccount = async () => {
    if (isAdmin) {
      setDeleteError('Administrator accounts cannot be self-deleted.')
      return
    }
    setDeletingAccount(true)
    setDeleteError(null)
    try {
      await deleteMyAccount({
        reason: deleteReason || null,
        note: deleteNote || null,
      })
      navigate(ROUTES.landing, { replace: true })
    } catch (err) {
      setDeleteError(
        err instanceof Error
          ? err.message
          : 'Could not delete account. Make sure delete_my_account() is added in Supabase.',
      )
      setDeletingAccount(false)
    }
  }

  const email = user?.email ?? profile?.email ?? null
  const avatarUrl = profile?.avatar_url ?? user?.user_metadata?.avatar_url ?? null
  const initial = displayName.trim().length > 0 ? displayName.trim().slice(0, 1).toUpperCase() : '?'

  const planLabel = usage?.trialExpired
    ? 'Trial Ended'
    : quotaExhausted
      ? 'Limit Reached'
      : usage?.status === 'trialing' && usage?.tier === 'free'
        ? `Free Trial · ${usage.trialDaysRemaining ?? 0}d left`
        : (profile?.tier ?? 'Pro').toUpperCase()

  const activeSection: DashSection =
    !isAdmin && (section === 'members' || section === 'stories') ? 'overview' : section

  const navItems: { id: DashSection; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'overview', label: 'Overview', icon: <ActivityIcon size={14} /> },
    { id: 'sources', label: 'Research Sources', icon: <DatabaseIcon size={14} /> },
    ...(isAdmin
      ? [
          {
            id: 'members' as const,
            label: 'Members',
            icon: <UserIcon size={14} />,
            badge: overview.users,
          },
          {
            id: 'stories' as const,
            label: 'Published',
            icon: <FileIcon size={14} />,
          },
        ]
      : []),
    { id: 'account', label: 'Account & Security', icon: <SettingsIcon size={14} /> },
  ]

  return (
    <div className="shell-frame">
      <Header
        variant="dashboard"
        sidebarOpen={sidebarOpen}
        onToggleSidebar={handleToggleSidebar}
      />

      <div className={`dash-shell ${sidebarOpen ? 'is-sidebar-open' : 'is-sidebar-collapsed'}`}>
        {/* Backdrop overlay on tablet/mobile <= 786px */}
        {sidebarOpen ? (
          <div
            className="dash-sidebar-backdrop"
            onClick={handleToggleSidebar}
            aria-hidden="true"
          />
        ) : null}

        {/* Unified Dashboard Sidebar */}
        <aside className="dash-sidebar" aria-label="Dashboard navigation">
          <div className="dash-sidebar-profile">
            <div className="dash-sidebar-profile-main">
              {avatarUrl ? (
                <img className="dash-sidebar-avatar" src={avatarUrl} alt="" />
              ) : (
                <span className="dash-sidebar-avatar is-fallback" aria-hidden="true">
                  {initial}
                </span>
              )}
              <div className="dash-sidebar-identity">
                <span className="dash-sidebar-name">{displayName}</span>
                <span className="dash-sidebar-role">
                  {profile?.tier ? profile.tier.toUpperCase() : 'MEMBER'}
                </span>
              </div>
            </div>
          </div>

          <nav className="dash-sidebar-nav">
            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`dash-nav-item ${activeSection === item.id ? 'is-active' : ''}`}
                onClick={() => handleSelectSection(item.id)}
              >
                <span className="dash-nav-icon">{item.icon}</span>
                <span className="dash-nav-label">{item.label}</span>
                {typeof item.badge === 'number' && item.badge > 0 ? (
                  <span className="dash-nav-badge">{formatCount(item.badge)}</span>
                ) : null}
              </button>
            ))}
          </nav>

          <div className="dash-sidebar-footer">
            <button
              type="button"
              className="dash-btn dash-btn-primary dash-sidebar-cta"
              onClick={() => {
                if (typeof window !== 'undefined' && window.innerWidth <= 786) {
                  setSidebarOpen(false)
                }
                void handleOpenDataset()
              }}
            >
              <span>Open Workspace</span>
              <ArrowRightIcon size={12} />
            </button>

            <button
              type="button"
              className="dash-sidebar-link"
              onClick={() => {
                if (typeof window !== 'undefined' && window.innerWidth <= 786) {
                  setSidebarOpen(false)
                }
                navigate(ROUTES.landing)
              }}
            >
              <GlobeIcon size={12} />
              <span>View Public Site</span>
            </button>
          </div>
        </aside>

        {/* Main Content Canvas */}
        <main className="dash-main">
          {/* Top Command Header */}
          <header className="dash-hero-bar">
            <div className="dash-hero-copy">
              <div className="dash-hero-eyebrow-row">
                <span className="dash-eyebrow">
                  {activeSection === 'overview' && 'Dashboard'}
                  {activeSection === 'sources' && 'Open Research & Datasets'}
                  {activeSection === 'members' && 'Directory'}
                  {activeSection === 'stories' && 'Editorial'}
                  {activeSection === 'account' && 'Account & Security'}
                </span>
                {!isAdmin ? (
                  <span className="dash-status-pill">{planLabel}</span>
                ) : null}
              </div>
              <h1 className="dash-title">
                {activeSection === 'overview' &&
                  (user ? `Welcome back, ${displayName.split(' ')[0]}` : 'Your Workspace')}
                {activeSection === 'sources' && 'Research Sources & Open Data'}
                {activeSection === 'members' && 'Members & Subscriptions'}
                {activeSection === 'stories' && 'Published'}
                {activeSection === 'account' && 'Profile, Preferences & Security'}
              </h1>
              <p className="dash-subtitle">
                {activeSection === 'overview' &&
                  (isAdmin
                    ? 'Monitor members, active plans, and your local spreadsheets in one place.'
                    : 'Pick up where you left off and manage your workspace.')}
                {activeSection === 'sources' &&
                  'Discover free open scientific repositories like Kaggle and Hugging Face, or analyze benchmark workbooks directly in Tabula.'}
                {activeSection === 'members' &&
                  'Filter accounts by plan, trial status, or administrator role.'}
                {activeSection === 'stories' &&
                  'Review, edit, or unpublish stories shared from your workspace.'}
                {activeSection === 'account' &&
                  'Manage your profile details, theme, and account security.'}
              </p>
            </div>

            <div className="dash-hero-actions">
              {!isAdmin &&
              usage &&
              (usage.tier === 'free' || usage.trialExpired || quotaExhausted) ? (
                <button
                  type="button"
                  className="dash-btn dash-btn-secondary"
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
                  <ZapIcon size={13} />
                  <span>
                    {usage.trialExpired || quotaExhausted ? 'Upgrade Now' : 'Upgrade to Pro'}
                  </span>
                </button>
              ) : null}

              <button
                type="button"
                className="dash-btn dash-btn-primary"
                onClick={() => void handleOpenDataset()}
              >
                <span>Open Workspace</span>
                <ArrowRightIcon size={13} />
              </button>
            </div>
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

          {!isAdmin && usage && (usage.trialExpired || quotaExhausted) ? (
            <div className="dash-banner-alert">
              <div className="dash-banner-alert-copy">
                <AlertIcon size={16} />
                <span>
                  {usage.trialExpired
                    ? 'Your 7-day free trial has ended. Upgrade to continue analyzing spreadsheets.'
                    : `You have used all ${formatCount(usage.monthlyLimit ?? 250000)} trial tokens. Upgrade to Pro to continue.`}
                </span>
              </div>
              <button
                type="button"
                className="dash-btn dash-btn-primary dash-btn-sm"
                onClick={() =>
                  openPricingModal(usage.trialExpired ? 'trial-expired' : 'quota-exceeded')
                }
              >
                Upgrade to Pro
              </button>
            </div>
          ) : null}

          {/* Dynamic Content Pane with Smooth View Transition */}
          <div key={activeSection} className="dash-section-pane">
            {/* SECTION: OVERVIEW */}
            {activeSection === 'overview' && (
            <>
              <section className="dash-metrics-strip" aria-label="Overview metrics">
                {isAdmin ? (
                  <>
                    <Metric
                      label="Total Members"
                      value={formatCount(overview.users)}
                      hint={`${overview.admins} admin${overview.admins === 1 ? '' : 's'}`}
                      icon={<DatabaseIcon size={13} />}
                    />
                    <Metric
                      label="Paid Subscribers"
                      value={formatCount(overview.subscribers)}
                      hint={`${formatCount(overview.trialing)} active trial${overview.trialing === 1 ? '' : 's'}`}
                      icon={<BarChartIcon size={13} />}
                    />
                    <Metric
                      label="Your Datasets"
                      value={formatCount(stats?.datasets ?? 0)}
                      hint={`${formatCount(stats?.rows ?? 0)} rows locally`}
                      icon={<SheetIcon size={13} />}
                    />
                    <Metric
                      label="Questions Asked"
                      value={formatCount(stats?.questions ?? 0)}
                      hint="Saved on this device"
                      icon={<ZapIcon size={13} />}
                    />
                  </>
                ) : (
                  <>
                    <Metric
                      label="Datasets"
                      value={formatCount(stats?.datasets ?? 0)}
                      hint={`${formatCount(stats?.rows ?? 0)} total rows`}
                      icon={<SheetIcon size={13} />}
                    />
                    <Metric
                      label="Questions Asked"
                      value={formatCount(stats?.questions ?? 0)}
                      hint="Saved on this device"
                      icon={<ZapIcon size={13} />}
                    />
                    <Metric
                      label="Usage"
                      value={
                        usage?.monthlyLimit !== null
                          ? `${usagePct}%`
                          : formatCount(usage?.usedTokens ?? 0)
                      }
                      hint={
                        usage?.monthlyLimit !== null
                          ? `${formatCount(usage?.remainingTokens ?? 0)} remaining`
                          : 'Unlimited monthly quota'
                      }
                      icon={<BarChartIcon size={13} />}
                    />
                    <Metric
                      label="Current Plan"
                      value={
                        usage?.trialExpired
                          ? 'Ended'
                          : usage?.status === 'trialing' && usage?.tier === 'free'
                            ? `${usage.trialDaysRemaining ?? 0}d left`
                            : (profile?.tier ?? 'Free')
                      }
                      hint="100% private on-device"
                      icon={<GlobeIcon size={13} />}
                    />
                  </>
                )}
              </section>

              <div className="dash-studio-grid">
                <section className="dash-card dash-datasets-card">
                  <div className="dash-card-head">
                    <div>
                      <h2 className="dash-card-title">Your Datasets</h2>
                      <p className="dash-card-desc">
                        Spreadsheets stored privately in this browser — never uploaded to any server.
                      </p>
                    </div>
                    <span className="dash-count-pill">{stats?.datasets ?? 0}</span>
                  </div>

                  {(stats?.items.length ?? 0) > 0 ? (
                    <div className="dash-input-search-wrap">
                      <SearchIcon size={14} />
                      <input
                        type="text"
                        className="dash-input dash-input-search"
                        value={datasetQuery}
                        onChange={(e) => setDatasetQuery(e.target.value)}
                        placeholder="Filter your spreadsheets…"
                        aria-label="Filter your spreadsheets"
                      />
                      {datasetQuery ? (
                        <button
                          type="button"
                          className="dash-input-clear"
                          onClick={() => setDatasetQuery('')}
                          aria-label="Clear filter"
                        >
                          <CloseIcon size={13} />
                        </button>
                      ) : null}
                    </div>
                  ) : null}

                  {filteredDatasets.length > 0 ? (
                    <ul className="dash-dataset-list">
                      {filteredDatasets.map((item) => (
                        <li key={item.id} className="dash-dataset-row">
                          <div className="dash-dataset-icon">
                            <SheetIcon size={14} />
                          </div>
                          <div className="dash-dataset-info">
                            <span className="dash-dataset-name">{item.name}</span>
                            <span className="dash-dataset-meta">
                              {formatCount(item.rows)} rows · {formatCount(item.questions)} messages
                            </span>
                          </div>
                          <button
                            type="button"
                            className="dash-btn dash-btn-ghost dash-btn-sm"
                            onClick={() => void handleOpenDataset(item.id)}
                          >
                            <span>Open</span>
                            <ArrowRightIcon size={12} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (stats?.items.length ?? 0) > 0 ? (
                    <div className="dash-empty-box">
                      <p>No spreadsheets match “{datasetQuery}”.</p>
                      <button
                        type="button"
                        className="dash-btn dash-btn-ghost dash-btn-sm"
                        onClick={() => setDatasetQuery('')}
                      >
                        Clear filter
                      </button>
                    </div>
                  ) : (
                    <div className="dash-empty-box">
                      <div className="dash-empty-icon">
                        <SheetIcon size={18} />
                      </div>
                      <h3>No spreadsheets loaded yet</h3>
                      <p>Drop an Excel or CSV file into the workspace to start asking questions.</p>
                      <button
                        type="button"
                        className="dash-btn dash-btn-primary dash-btn-sm"
                        onClick={() => void handleOpenDataset()}
                      >
                        <span>Open Workspace</span>
                        <ArrowRightIcon size={12} />
                      </button>
                    </div>
                  )}
                </section>

                <div className="dash-side-stack">
                  {/* Quick Shortcuts */}
                  <section className="dash-card">
                    <div className="dash-card-head">
                      <div>
                        <h2 className="dash-card-title">Quick Actions</h2>
                        <p className="dash-card-desc">Direct shortcuts to your work.</p>
                      </div>
                    </div>
                    <div className="dash-actions-stack">
                      <button
                        type="button"
                        className="dash-action-btn"
                        onClick={() => void handleOpenDataset()}
                      >
                        <div className="dash-action-icon">
                          <ZapIcon size={13} />
                        </div>
                        <div className="dash-action-body">
                          <span className="dash-action-title">Launch Workspace</span>
                          <span className="dash-action-text">Query your data privately</span>
                        </div>
                        <ArrowRightIcon size={13} />
                      </button>

                      <button
                        type="button"
                        className="dash-action-btn"
                        onClick={() => setSection('account')}
                      >
                        <div className="dash-action-icon">
                          <SettingsIcon size={13} />
                        </div>
                        <div className="dash-action-body">
                          <span className="dash-action-title">Account &amp; Security</span>
                          <span className="dash-action-text">Manage profile &amp; preferences</span>
                        </div>
                        <ArrowRightIcon size={13} />
                      </button>

                      <button
                        type="button"
                        className="dash-action-btn"
                        onClick={() => navigate(ROUTES.landing)}
                      >
                        <div className="dash-action-icon">
                          <GlobeIcon size={13} />
                        </div>
                        <div className="dash-action-body">
                          <span className="dash-action-title">Public Website</span>
                          <span className="dash-action-text">Explore features and stories</span>
                        </div>
                        <ArrowRightIcon size={13} />
                      </button>
                    </div>
                  </section>

                  {/* Privacy & Storage Guarantee */}
                  <section className="dash-card">
                    <div className="dash-card-head">
                      <div>
                        <h2 className="dash-card-title">Private Storage</h2>
                        <p className="dash-card-desc">Zero cloud retention guarantee.</p>
                      </div>
                    </div>
                    <ul className="dash-security-list" style={{ margin: 0, padding: 0, borderTop: 'none' }}>
                      <li>
                        <CheckIcon size={12} /> Stored 100% locally on your computer
                      </li>
                      <li>
                        <CheckIcon size={12} /> No spreadsheet data is uploaded to servers
                      </li>
                      <li>
                        <CheckIcon size={12} /> Queries executed safely in local sandbox
                      </li>
                    </ul>
                  </section>
                </div>
              </div>
            </>
          )}

          {/* SECTION: SOURCES */}
          {activeSection === 'sources' && (
            <ResearchSources onLoadDatasetFile={handleLoadSampleDataset} />
          )}

          {/* SECTION: MEMBERS (ADMIN ONLY) */}
          {activeSection === 'members' && isAdmin && (
            <div className="dash-admin-stack">
              <section className="dash-panel">
                <header className="dash-panel-head">
                  <div className="dash-panel-titles">
                    <h2 className="dash-section-title">Member Directory</h2>
                    <span className="dash-panel-note">
                      Live sign-ins, trial windows, and subscription status.
                    </span>
                  </div>

                  <div className="dash-filter-pills" role="tablist" aria-label="Filter members">
                    {(
                      [
                        ['all', `All (${overview.users})`],
                        ['subscribers', `Paid (${overview.subscribers})`],
                        ['trialing', `Trial (${overview.trialing})`],
                        ['suspended', `Suspended (${overview.suspended})`],
                        ['admins', `Admins (${overview.admins})`],
                      ] as const
                    ).map(([key, label]) => (
                      <button
                        key={key}
                        type="button"
                        role="tab"
                        aria-selected={memberFilter === key}
                        className={`dash-filter-pill ${memberFilter === key ? 'is-active' : ''}`}
                        onClick={() => setMemberFilter(key)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </header>

                {adminError ? (
                  <p className="publish-error" style={{ padding: '12px 18px' }}>
                    {adminError}
                    {schemaMissing
                      ? ' Apply features/migration/admin.sql (or tabula.sql) to your project to enable it.'
                      : ''}
                  </p>
                ) : null}

                <Members
                  members={filteredMembers}
                  emailGrants={emailGrants}
                  loading={membersLoading}
                  onRefresh={() => refreshAdminData(false)}
                />
              </section>

              {/* Admin Security Audit Log */}
              <section className="dash-panel">
                <header className="dash-panel-head">
                  <div className="dash-panel-titles">
                    <h2 className="dash-section-title">Security &amp; Plan Audit Log</h2>
                    <span className="dash-panel-note">
                      Immutable record of manual Pro grants, token overrides, suspensions, and deletions.
                    </span>
                  </div>
                  <span className="dash-count-pill">{auditLogs.length}</span>
                </header>

                {auditLogs.length === 0 ? (
                  <div className="dash-table-empty">No admin actions recorded yet.</div>
                ) : (
                  <ul className="dash-deletions-list">
                    {auditLogs.slice(0, 20).map((log) => (
                      <li key={log.id} className="dash-deletion-row">
                        <div className="dash-deletion-top">
                          <div className="dash-deletion-user">
                            <strong>{log.action.replace(/_/g, ' ')}</strong>
                            <span>
                              {log.target_email || log.target_user_id || 'Unknown target'} · by{' '}
                              {log.admin_email || 'admin'}
                            </span>
                          </div>
                          <div className="dash-deletion-meta">
                            {log.details?.tier ? (
                              <span className={`dash-plan is-${String(log.details.tier)}`}>
                                {String(log.details.tier)}
                              </span>
                            ) : null}
                            <span className="dash-deletion-date">
                              {new Date(log.created_at).toLocaleString(undefined, {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {/* Deleted Accounts & Optional Exit Feedback */}
              <section className="dash-panel">
                <header className="dash-panel-head">
                  <div className="dash-panel-titles">
                    <h2 className="dash-section-title">Deleted Accounts &amp; Feedback</h2>
                    <span className="dash-panel-note">
                      Users who deleted their account and any optional feedback they left.
                    </span>
                  </div>
                  <span className="dash-count-pill">{deletedAccounts.length}</span>
                </header>

                {deletedAccounts.length === 0 ? (
                  <div className="dash-table-empty">No deleted accounts recorded yet.</div>
                ) : (
                  <ul className="dash-deletions-list">
                    {deletedAccounts.map((entry) => (
                      <li key={entry.id} className="dash-deletion-row">
                        <div className="dash-deletion-top">
                          <div className="dash-deletion-user">
                            <strong>{entry.display_name || entry.email || 'Former user'}</strong>
                            {entry.email ? <span>{entry.email}</span> : null}
                          </div>
                          <div className="dash-deletion-meta">
                            {entry.reason ? (
                              <span className="dash-deletion-reason">{entry.reason}</span>
                            ) : null}
                            <span className="dash-deletion-date">
                              {new Date(entry.deleted_at).toLocaleDateString(undefined, {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })}
                            </span>
                          </div>
                        </div>
                        {entry.note ? <p className="dash-deletion-note">“{entry.note}”</p> : null}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          )}

          {/* SECTION: PUBLISHED STORIES (ADMIN ONLY) */}
          {activeSection === 'stories' && isAdmin && <Insights />}

          {/* SECTION: ACCOUNT & SECURITY */}
          {activeSection === 'account' && (
            <div className="dash-account-grid">
              <section className="dash-card">
                <div className="dash-profile-header">
                  {avatarUrl ? (
                    <img className="dash-avatar-lg" src={avatarUrl} alt="" />
                  ) : (
                    <span className="dash-avatar-lg is-fallback" aria-hidden="true">
                      {initial}
                    </span>
                  )}
                  <div className="dash-profile-meta">
                    <h2 className="dash-card-title">{displayName}</h2>
                    {email ? <p className="dash-profile-email">{email}</p> : null}
                  </div>
                </div>

                <form className="dash-form" onSubmit={(e) => void handleSaveName(e)}>
                  <label className="dash-field">
                    <span className="dash-label">Display Name</span>
                    <div className="dash-input-row">
                      <input
                        type="text"
                        className="dash-input"
                        value={nameInput}
                        onChange={(e) => setNameInput(e.target.value)}
                        placeholder="Your name"
                        maxLength={80}
                        disabled={!isSupabaseConfigured || nameSaving}
                      />
                      <button
                        type="submit"
                        className="dash-btn dash-btn-primary dash-btn-input"
                        disabled={
                          !isSupabaseConfigured ||
                          nameSaving ||
                          nameInput.trim().length === 0 ||
                          nameInput.trim() === displayName.trim()
                        }
                      >
                        {nameSaving ? 'Saving…' : nameSaved ? 'Saved' : 'Save'}
                      </button>
                    </div>
                  </label>

                  {nameSaved ? (
                    <p className="dash-field-feedback is-success">
                      <CheckIcon size={13} /> Display name updated.
                    </p>
                  ) : null}
                  {nameError ? <p className="dash-field-feedback is-error">{nameError}</p> : null}
                </form>

                <div className="dash-divider" />

                <div className="dash-pref-row">
                  <div>
                    <span className="dash-label">Appearance</span>
                    <p className="dash-pref-hint">Choose your preferred workspace theme.</p>
                  </div>
                  <div className="dash-segmented" role="group" aria-label="Theme preference">
                    <button
                      type="button"
                      className={`dash-seg-btn ${theme === 'light' ? 'is-active' : ''}`}
                      onClick={() => applyTheme('light')}
                    >
                      <SunIcon size={13} />
                      <span>Light</span>
                    </button>
                    <button
                      type="button"
                      className={`dash-seg-btn ${theme === 'dark' ? 'is-active' : ''}`}
                      onClick={() => applyTheme('dark')}
                    >
                      <MoonIcon size={13} />
                      <span>Dark</span>
                    </button>
                  </div>
                </div>

                {!isAdmin && usage && usage.monthlyLimit !== null ? (
                  <>
                    <div className="dash-divider" />
                    <div className="dash-quota-block">
                      <div className="dash-quota-top">
                        <span className="dash-label">Plan Usage</span>
                        <span className="dash-quota-nums">
                          {formatCount(usage.usedTokens)} / {formatCount(usage.monthlyLimit)}
                        </span>
                      </div>
                      <div className="dash-quota-track">
                        <div
                          className={`dash-quota-fill ${usagePct >= 90 ? 'is-danger' : ''}`}
                          style={{ width: `${usagePct}%` }}
                        />
                      </div>
                    </div>
                  </>
                ) : null}
              </section>

              {/* Security & Deletion Card */}
              <div className="dash-side-stack">
                {isAdmin ? (
                  <section className="dash-card dash-security-card">
                    <div className="dash-security-badge">
                      <ShieldCheckIcon size={15} />
                      <span>Administrator Protection Active</span>
                    </div>
                    <h2 className="dash-card-title">Protected Admin Account</h2>
                    <p className="dash-card-desc">
                      For security, administrator accounts cannot be self-deleted or self-demoted
                      from the dashboard. Role changes and account removal are enforced strictly at
                      the database level in Supabase.
                    </p>
                    <ul className="dash-security-list">
                      <li>
                        <CheckIcon size={13} /> Self-deletion blocked in UI &amp; database
                      </li>
                      <li>
                        <CheckIcon size={13} /> Self-demotion blocked by database trigger
                      </li>
                      <li>
                        <CheckIcon size={13} /> Sensitive profile columns locked from tampering
                      </li>
                    </ul>
                  </section>
                ) : user && isSupabaseConfigured ? (
                  <section className="dash-card dash-danger-card">
                    <div className="dash-danger-head">
                      <h2 className="dash-card-title dash-danger-title">Delete Account</h2>
                      <p className="dash-card-desc">
                        Permanently remove your account, profile, and local data. This cannot be
                        undone.
                      </p>
                    </div>

                    {!confirmDeleteOpen ? (
                      <button
                        type="button"
                        className="dash-btn dash-btn-danger-outline"
                        onClick={() => {
                          setDeleteError(null)
                          setConfirmDeleteOpen(true)
                        }}
                      >
                        <TrashIcon size={14} />
                        <span>Delete my account</span>
                      </button>
                    ) : (
                      <div
                        className="dash-confirm-box"
                        role="alertdialog"
                        aria-label="Confirm account deletion"
                      >
                        <p className="dash-confirm-text">
                          <ShieldCheckIcon size={14} />
                          <span>
                            Confirm permanent deletion of <strong>{email ?? displayName}</strong>?
                          </span>
                        </p>

                        <div className="dash-exit-feedback">
                          <span className="dash-exit-label">
                            Quick feedback? <em>(optional)</em>
                          </span>
                          <div className="dash-exit-chips">
                            {EXIT_REASONS.map((reason) => (
                              <button
                                key={reason}
                                type="button"
                                className={`dash-exit-chip ${deleteReason === reason ? 'is-active' : ''}`}
                                onClick={() =>
                                  setDeleteReason((prev) => (prev === reason ? '' : reason))
                                }
                              >
                                {reason}
                              </button>
                            ))}
                          </div>
                          <input
                            type="text"
                            className="dash-input dash-exit-input"
                            value={deleteNote}
                            onChange={(e) => setDeleteNote(e.target.value)}
                            placeholder="Anything we could improve? (optional)"
                            maxLength={500}
                            disabled={deletingAccount}
                          />
                        </div>

                        {deleteError ? (
                          <p className="dash-field-feedback is-error">{deleteError}</p>
                        ) : null}
                        <div className="dash-confirm-actions">
                          <button
                            type="button"
                            className="dash-btn dash-btn-danger"
                            disabled={deletingAccount}
                            onClick={() => void handleDeleteAccount()}
                          >
                            <TrashIcon size={14} />
                            <span>{deletingAccount ? 'Deleting…' : 'Confirm & Delete'}</span>
                          </button>
                          <button
                            type="button"
                            className="dash-btn dash-btn-ghost"
                            disabled={deletingAccount}
                            onClick={() => {
                              setConfirmDeleteOpen(false)
                              setDeleteError(null)
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </section>
                ) : null}
              </div>
            </div>
          )}
          </div>
        </main>
      </div>
    </div>
  )
}
