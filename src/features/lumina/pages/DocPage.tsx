import { useEffect, useMemo, useState } from 'react'
import { Link, useRouter } from '../../../core/router'
import { useIsAdmin } from '../../auth/useProfile'
import { PlusIcon } from '../../common/Icons'
import { fetchLuminaDocsMap, type LuminaDocRecord } from '../api/docs'
import { useLuminaRelease } from '../api/release'
import { DocModal } from '../components/DocModal'
import { InstallerGrid } from '../components/Installers'
import { extractDocHeadings, Markdown } from '../components/Markdown'
import { Shell } from '../components/Shell'
import {
  buildSidebarGroups,
  findLuminaDocByPath,
  pathToDocSlug,
} from '../content'

export function DocPage() {
  const { path } = useRouter()
  const isAdmin = useIsAdmin()
  const release = useLuminaRelease()
  const [dbDocsMap, setDbDocsMap] = useState<Record<string, LuminaDocRecord>>({})
  const [loading, setLoading] = useState(true)
  const [editingModalOpen, setEditingModalOpen] = useState(false)

  useEffect(() => {
    let mounted = true
    setLoading(true)
    fetchLuminaDocsMap()
      .then((map) => {
        if (mounted) setDbDocsMap(map)
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [])

  const slug = useMemo(() => pathToDocSlug(path), [path])
  const staticBaseline = useMemo(() => findLuminaDocByPath(path), [path])
  const dbDoc = dbDocsMap[slug]

  const activeSection = dbDoc?.section ?? staticBaseline?.section ?? 'Features'
  const activeTitle = dbDoc?.title || staticBaseline?.title || 'Lumina Documentation'
  const activeSubtitle = dbDoc?.subtitle ?? staticBaseline?.subtitle ?? ''
  const activeContent = dbDoc?.content || staticBaseline?.content || ''
  const activeSortOrder = dbDoc?.sort_order ?? staticBaseline?.sortOrder ?? 100

  const headings = useMemo(() => extractDocHeadings(activeContent), [activeContent])

  // Build ordered flat page list from dynamic sidebar groups for Prev / Next navigation
  const flatNavItems = useMemo(() => {
    const groups = buildSidebarGroups(dbDocsMap)
    const items: Array<{ label: string; to: string }> = []
    for (const g of groups) {
      for (const item of g.items) {
        items.push({ label: item.label, to: item.to })
      }
    }
    return items
  }, [dbDocsMap])

  const normalizedPath = path.replace(/\/+$/, '') || '/lumina'
  const currentNavIdx = flatNavItems.findIndex((item) => item.to === normalizedPath)
  const prevItem = currentNavIdx > 0 ? flatNavItems[currentNavIdx - 1] : null
  const nextItem =
    currentNavIdx >= 0 && currentNavIdx < flatNavItems.length - 1
      ? flatNavItems[currentNavIdx + 1]
      : null

  const showInstallers = slug === 'overview' || slug === 'installation'
  const hasProseContent = activeContent.trim().length > 0

  return (
    <Shell
      release={release}
      headings={headings}
      dbDocsMap={dbDocsMap}
      activeDocForEdit={{
        slug,
        section: activeSection,
        title: activeTitle,
        subtitle: activeSubtitle,
        summary: activeSubtitle,
        content: activeContent,
        sort_order: activeSortOrder,
        published: true,
      }}
      onDocSaved={(saved) => {
        setDbDocsMap((prev) => ({ ...prev, [saved.slug]: saved }))
      }}
    >
      <article className="lumina-doc-article">
        <header className="lumina-doc-header">
          <div className="lumina-doc-header-top">
            <span className="lumina-doc-kicker">{activeSection}</span>
          </div>
          <h1 className="lumina-doc-title">{activeTitle}</h1>
          {activeSubtitle ? <p className="lumina-doc-subtitle">{activeSubtitle}</p> : null}
        </header>

        {showInstallers ? <InstallerGrid release={release} /> : null}

        {loading && !hasProseContent ? (
          <div className="lumina-empty-card">Loading documentation…</div>
        ) : hasProseContent ? (
          <Markdown content={activeContent} />
        ) : (
          <div className="lumina-empty-card">
            <h3>No documentation content written for “{activeTitle}” yet</h3>
            <p>
              {isAdmin
                ? 'Use the floating + button at the bottom-right corner or click below to write this page in Markdown.'
                : 'This documentation section is being prepared.'}
            </p>
            {isAdmin ? (
              <button
                type="button"
                className="btn btn-small btn-primary"
                style={{ marginTop: 12 }}
                onClick={() => setEditingModalOpen(true)}
              >
                <PlusIcon size={12} />
                <span>Write “{activeTitle}” Content</span>
              </button>
            ) : null}
          </div>
        )}

        <nav className="lumina-prev-next" aria-label="Documentation pagination">
          {prevItem ? (
            <Link to={prevItem.to} className="lumina-prev-next-card is-prev">
              <span className="lumina-prev-next-dir">← Previous</span>
              <span className="lumina-prev-next-title">{prevItem.label}</span>
            </Link>
          ) : (
            <div />
          )}

          {nextItem ? (
            <Link to={nextItem.to} className="lumina-prev-next-card is-next">
              <span className="lumina-prev-next-dir">Next →</span>
              <span className="lumina-prev-next-title">{nextItem.label}</span>
            </Link>
          ) : null}
        </nav>
      </article>

      {editingModalOpen ? (
        <DocModal
          doc={{
            slug,
            section: activeSection,
            title: activeTitle,
            subtitle: activeSubtitle,
            summary: activeSubtitle,
            content: activeContent,
            sort_order: activeSortOrder,
            published: true,
          }}
          onClose={() => setEditingModalOpen(false)}
          onSaved={(saved) => {
            setDbDocsMap((prev) => ({ ...prev, [saved.slug]: saved }))
          }}
        />
      ) : null}
    </Shell>
  )
}
