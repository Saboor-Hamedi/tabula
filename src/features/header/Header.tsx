import { useContext } from 'react'
import { useRouter } from '../../core/router'
import { ROUTES, userPath } from '../../core/router/paths'
import { signOutAccount } from '../../core/supabase/signOut'
import { useAuthUser, useProfile, useUserSlug } from '../auth/useProfile'
import {
  MoonIcon,
  PanelRightIcon,
  SidebarIcon,
  SunIcon,
  TrashIcon,
} from '../common/Icons'
import { IconButton } from '../common/IconButton'
import { useOnline } from '../common/useOnline'
import { useTheme } from '../common/useTheme'
import {
  SessionActionsContext,
  SessionStateContext,
} from '../session/sessionContext'
import { Account } from './Account'
import { Brand } from './Brand'
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
  onSignIn?: () => void
  onSignUp?: () => void
}

export function Header({ variant = 'page', onSignIn, onSignUp }: HeaderProps) {
  const { navigate } = useRouter()
  const session = useContext(SessionStateContext)
  const actions = useContext(SessionActionsContext)
  const user = useAuthUser()
  const profile = useProfile()
  const userSlug = useUserSlug()
  const { theme, toggleTheme } = useTheme()
  const online = useOnline()

  const isWorkspace = variant === 'workspace'
  const isDashboard = variant === 'dashboard'
  const canClearChat = isWorkspace && Boolean(session?.activeSession) && (session?.messages.length ?? 0) > 0

  return (
    <header className={`app-header ${isWorkspace ? 'is-workspace' : isDashboard ? 'is-dashboard' : 'is-page'}`}>
      <div className="app-header-left">
        {isWorkspace && session && actions ? (
          <IconButton
            label={session.sidebarOpen ? 'Hide sources' : 'Show sources'}
            active={session.sidebarOpen}
            onClick={() => actions.toggleSidebar()}
          >
            <SidebarIcon size={17} />
          </IconButton>
        ) : null}

        {!isWorkspace ? (
          <>
            <Brand to={isDashboard ? userPath('/app', userSlug) : ROUTES.landing} />
            {!isDashboard ? <Nav isAuthenticated={Boolean(user)} /> : null}
          </>
        ) : null}

        {!online ? <span className="offline-pill">Offline</span> : null}
      </div>

      <div className="app-header-right">
        {canClearChat && actions ? (
          <IconButton label="Clear chat history" onClick={actions.requestClearChat}>
            <TrashIcon size={16} />
          </IconButton>
        ) : null}

        <IconButton
          label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          onClick={(event) => toggleTheme(event)}
        >
          {theme === 'dark' ? <SunIcon size={16} /> : <MoonIcon size={16} />}
        </IconButton>

        {isWorkspace && session && actions ? (
          <IconButton
            label={session.panelOpen ? 'Hide inspector' : 'Show inspector'}
            active={session.panelOpen}
            onClick={() =>
              session.panelOpen ? actions.closePanel() : actions.openPanel('notes')
            }
          >
            <PanelRightIcon size={17} />
          </IconButton>
        ) : null}

        {!isWorkspace ? (
          <Account
            isAuthenticated={Boolean(user)}
            email={user?.email ?? profile?.email ?? null}
            showWorkspaceLink={!isDashboard}
            onSignIn={onSignIn ?? (() => navigate(ROUTES.signIn))}
            onSignUp={onSignUp ?? (() => navigate(ROUTES.signUp))}
            onSignOut={() => void signOutAccount()}
            onOpenWorkspace={() => navigate(userPath('/workspace', userSlug))}
          />
        ) : null}
      </div>
    </header>
  )
}
