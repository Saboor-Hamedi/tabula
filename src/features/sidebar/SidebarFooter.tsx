import { SettingsIcon } from '../common/Icons'
import { useSessionActions, useSessionState } from '../SessionProvider'

/**
 * Sidebar footer.
 *
 * Holds the only settings entry point in the sidebar. The header carries the
 * model switcher, so settings are not duplicated in two places.
 */

export function SidebarFooter() {
  const { apiKey } = useSessionState()
  const { openSettings } = useSessionActions()

  return (
    <div className="sidebar-footer">
      <button type="button" className="sidebar-settings" onClick={openSettings}>
        <SettingsIcon size={15} />
        <span>Settings</span>
        {!apiKey ? <span className="sidebar-dot" aria-label="Access key required" /> : null}
      </button>
    </div>
  )
}
