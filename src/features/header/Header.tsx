import { useContext, useEffect, useState } from 'react'
import { useRouter } from '../../core/router'
import { ROUTES, userPath } from '../../core/router/paths'
import { signOutAccount } from '../../core/supabase/signOut'
import { useAuthUser, useProfile, useUserSlug } from '../auth/useProfile'
import { BackTop } from '../common/BackTop'
import {
  ArrowRightIcon,
  PanelRightIcon,
  SidebarIcon,
  TrashIcon,
} from '../common/Icons'
import { IconButton } from '../common/IconButton'
import { useOnline } from '../common/useOnline'
import {
  SessionActionsContext,
  SessionStateContext,
} from '../session/sessionContext'
import { Account } from './Account'
import { Brand } from './Brand'
import { HeaderSearch } from './HeaderSearch'
import { Nav } from './Nav'

/**
 * The header.
 *
 * One header for the whole product: the workspace, the dashboard and the
 * published insights all share it, so navigation never depends on where the
 * visitor happens to be.
 *
 * Members only ever get the surfaces they are meant to use: Analyse and the
 * Workspace. Insights belongs to administrators, and the published sections
 * are public.
 */

export interface HeaderProps {
  /**
   * `workspace`: slim chat bar controls only (no brand, no nav, no account dropdown).
   * `dashboard`: isolated dashboard header — app name only on left, account/theme on right.
   * `page`: unified public header shared across Landing, Insights, and Articles.
   */
  variant?: 'workspace' | 'page' | 'dashboard'
  sidebarOpen?: boolean
  onToggleSidebar?: () => void
  onSignIn?: () => void
  onSignUp?: () => void
}

export function Header({
  variant = 'page',
  sidebarOpen = true,
  onToggleSidebar,
  onSignIn,
  onSignUp,
}: HeaderProps) {
  const { navigate, path } = useRouter()
  const session = useContext(SessionStateContext)
  const actions = useContext(SessionActionsContext)
  const user = useAuthUser()
  const profile = useProfile()
  const userSlug = useUserSlug()
  const online = useOnline()

  const isWorkspace = variant === 'workspace'
  const isDashboard = variant === 'dashboard'
  const isPage = variant === 'page'
  const isLanding = path === ROUTES.landing || path === '/'
  const canClearChat = isWorkspace && Boolean(session?.activeSession) && (session?.messages.length ?? 0) > 0

  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    if (!isPage) return
    const onScroll = () => setScrolled(window.scrollY > 12)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [isPage])

  const isSignedIn = Boolean(user && !user.is_anonymous)
  const workspaceTarget = isSignedIn ? userPath('/workspace', userSlug) : ROUTES.workspace

  return (
    <>
    <header
      className={`app-header ${isWorkspace ? 'is-workspace' : isDashboard ? 'is-dashboard' : 'is-page'}${scrolled ? ' is-scrolled' : ''}`}
    >
      <div className="app-header-left">
        {isWorkspace && session && actions ? (
          <span className="workspace-header-toggle-desktop">
            <IconButton
              label={session.sidebarOpen ? 'Collapse sources' : 'Expand sources'}
              active={session.sidebarOpen}
              onClick={() => actions.toggleSidebar()}
            >
              <SidebarIcon size={16} />
            </IconButton>
          </span>
        ) : null}

        {!isWorkspace ? (
          <Brand to={isDashboard ? userPath('/app', userSlug) : ROUTES.landing} />
        ) : null}

        {isDashboard && onToggleSidebar ? (
          <span className="dashboard-header-toggle">
            <IconButton
              label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
              active={sidebarOpen}
              onClick={onToggleSidebar}
            >
              <SidebarIcon size={16} />
            </IconButton>
          </span>
        ) : null}

        {!isWorkspace && !isDashboard ? <Nav isAuthenticated={isSignedIn} /> : null}

        {!online ? <span className="offline-pill">Offline</span> : null}
      </div>

      <div className="app-header-right">
        {isPage ? <HeaderSearch /> : null}
        {isPage && (!isLanding || isSignedIn) ? (
          <button
            type="button"
            className="header-workspace-cta"
            onClick={() => navigate(workspaceTarget)}
          >
            <span>{isSignedIn ? 'Workspace' : 'Analyze Free'}</span>
            <ArrowRightIcon size={13} />
          </button>
        ) : null}
        {canClearChat && actions ? (
          <IconButton label="Clear chat history" onClick={actions.requestClearChat}>
            <TrashIcon size={16} />
          </IconButton>
        ) : null}

        {isWorkspace && session && actions ? (
          <span className="workspace-header-toggle-desktop">
            <IconButton
              label={session.panelOpen ? 'Collapse studio' : 'Expand studio'}
              active={session.panelOpen}
              onClick={() =>
                session.panelOpen ? actions.closePanel() : actions.openPanel('notes')
              }
            >
              <PanelRightIcon size={16} />
            </IconButton>
          </span>
        ) : null}

        {!isWorkspace ? (
          <Account
            isAuthenticated={isSignedIn}
            email={user?.email ?? profile?.email ?? null}
            showWorkspaceLink={!isDashboard}
            onSignIn={onSignIn ?? (() => navigate(ROUTES.signIn))}
            onSignUp={onSignUp ?? (() => navigate(ROUTES.signUp))}
            onSignOut={() => void signOutAccount()}
            onOpenWorkspace={() => navigate(workspaceTarget)}
          />
        ) : null}
      </div>
    </header>
    {isPage ? <BackTop /> : null}
    </>
  )
}
