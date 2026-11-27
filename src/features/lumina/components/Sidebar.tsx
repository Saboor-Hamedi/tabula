import { useState } from 'react'
import { Link, useRouter } from '../../../core/router'
import type { LuminaDocRecord } from '../api/docs'
import { buildSidebarGroups } from '../content'

export interface SidebarProps {
  mobileOpen: boolean
  dbDocsMap?: Record<string, LuminaDocRecord>
}

export function Sidebar({ mobileOpen, dbDocsMap = {} }: SidebarProps) {
  const { path } = useRouter()
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({})

  const toggleGroup = (group: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [group]: !prev[group] }))
  }

  const normalizedPath = path.replace(/\/+$/, '') || '/lumina'
  const groups = buildSidebarGroups(dbDocsMap)

  return (
    <aside className={`lumina-sidebar ${mobileOpen ? 'is-mobile-open' : ''}`}>
      <nav className="lumina-sidebar-nav" aria-label="Lumina documentation">
        {groups.map((section) => {
          const isCollapsed = Boolean(collapsedGroups[section.group])
          return (
            <div key={section.group} className="lumina-nav-group">
              <button
                type="button"
                className="lumina-nav-group-header"
                onClick={() => toggleGroup(section.group)}
                aria-expanded={!isCollapsed}
              >
                <span>{section.label}</span>
                <span className={`lumina-nav-chevron ${isCollapsed ? 'is-collapsed' : ''}`}>
                  ▾
                </span>
              </button>
              {!isCollapsed ? (
                <ul className="lumina-nav-list">
                  {section.items.map((item) => {
                    const isActive =
                      item.to === '/lumina/posts'
                        ? normalizedPath.startsWith('/lumina/posts')
                        : normalizedPath === item.to
                    return (
                      <li key={item.to}>
                        <Link
                          to={item.to}
                          className={`lumina-nav-link ${isActive ? 'is-active' : ''}`}
                          aria-current={isActive ? 'page' : undefined}
                        >
                          <span>{item.label}</span>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              ) : null}
            </div>
          )
        })}
      </nav>
    </aside>
  )
}
