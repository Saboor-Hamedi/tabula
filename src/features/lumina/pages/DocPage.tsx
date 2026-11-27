import { useEffect, useMemo, useState } from 'react'
import { Link, useRouter } from '../../../core/router'
import { fetchLuminaDocsMap, type LuminaDocRecord } from '../api/docs'
import { useLuminaRelease } from '../api/release'
import { InstallerGrid } from '../components/Installers'
import { extractDocHeadings, Markdown } from '../components/Markdown'
import { Shell } from '../components/Shell'
import {
  findLuminaDocByPath,
  LUMINA_DOC_PAGES,
  type LuminaDocPageDef,
} from '../content'

const FEATURE_CARDS = [
  {
    title: 'Markdown Editor & Split Panes',
    desc: 'CodeMirror 6 plain-text .md editor with YAML frontmatter, wikilinks, KaTeX, Mermaid, and Zen Mode.',
    to: '/lumina/features/editor',
  },
  {
    title: 'Spatial Infinite Canvas (.canvas)',
    desc: 'Freeform 2D whiteboard saved as local .canvas JSON files with magnetic ports and orthogonal routing.',
    to: '/lumina/features/canvas',
  },
  {
    title: '2D & 3D Knowledge Graph',
    desc: 'Force-directed 2D Canvas and 3D WebGL (Three.js) graph views with cluster physics.',
    to: '/lumina/features/graph',
  },
  {
    title: 'AI Copilot & Local Models',
    desc: 'Offline Ollama + @xenova/transformers embeddings or DeepSeek/OpenAI/Claude with diff approval cards.',
    to: '/lumina/features/ai-copilot',
  },
  {
    title: 'Integrated Terminal (ConPTY / PTY)',
    desc: 'Native OS pseudoterminal powered by Rust portable-pty and WebGL-accelerated xterm.js (Ctrl + J).',
    to: '/lumina/features/terminal',
  },
  {
    title: 'Theme-Accurate Exports (50 Themes)',
    desc: 'Export notes to HTML, PDF (with auto-TOC), Word (.doc), Markdown, Plain Text, or ZIP.',
    to: '/lumina/features/exports',
  },
  {
    title: 'Google Drive & Gmail Sync',
    desc: 'Optional loopback OAuth 2.0 integration for direct Google Drive backups and Gmail workflows.',
    to: '/lumina/features/google-sync',
  },
  {
    title: 'Keyboard-First Workspace',
    desc: 'Global Spotlight (Ctrl + Space), Command Palette (Ctrl + P), Daily Notes, and Templates.',
    to: '/lumina/shortcuts',
  },
]

export function DocPage() {
  const { path } = useRouter()
  const release = useLuminaRelease()
  const [dbOverrides, setDbOverrides] = useState<Record<string, LuminaDocRecord>>({})

  useEffect(() => {
    let mounted = true
    fetchLuminaDocsMap().then((map) => {
      if (mounted) setDbOverrides(map)
    })
    return () => {
      mounted = false
    }
  }, [])

  const currentIndex = useMemo(() => {
    const clean = path.replace(/\/+$/, '') || '/lumina'
    const idx = LUMINA_DOC_PAGES.findIndex((p) => p.path === clean)
    return idx >= 0 ? idx : 0
  }, [path])

  const baseDoc: LuminaDocPageDef =
    findLuminaDocByPath(path) ?? LUMINA_DOC_PAGES[0]

  const dbDoc = dbOverrides[baseDoc.slug]
  const activeTitle = dbDoc?.title || baseDoc.title
  const activeSubtitle = dbDoc?.subtitle || baseDoc.subtitle
  const activeContent = dbDoc?.content || baseDoc.content

  const headings = useMemo(() => extractDocHeadings(activeContent), [activeContent])

  const prevPage = currentIndex > 0 ? LUMINA_DOC_PAGES[currentIndex - 1] : null
  const nextPage =
    currentIndex < LUMINA_DOC_PAGES.length - 1
      ? LUMINA_DOC_PAGES[currentIndex + 1]
      : null

  const showInstallers = baseDoc.slug === 'overview' || baseDoc.slug === 'installation'
  const showFeatureGrid = baseDoc.slug === 'overview'

  return (
    <Shell
      release={release}
      headings={headings}
      activeDocForEdit={{
        slug: baseDoc.slug,
        section: baseDoc.section,
        title: activeTitle,
        subtitle: activeSubtitle,
        summary: baseDoc.summary,
        content: activeContent,
        sort_order: baseDoc.sortOrder,
        published: true,
      }}
      onDocSaved={(saved) => {
        setDbOverrides((prev) => ({ ...prev, [saved.slug]: saved }))
      }}
    >
      <article className="lumina-doc-article">
        <header className="lumina-doc-header">
          <div className="lumina-doc-header-top">
            <span className="lumina-doc-kicker">{baseDoc.section}</span>
          </div>
          <h1 className="lumina-doc-title">{activeTitle}</h1>
          <p className="lumina-doc-subtitle">{activeSubtitle}</p>
        </header>

        {showInstallers ? <InstallerGrid release={release} /> : null}

        {showFeatureGrid ? (
          <section className="lumina-feature-cards-section" aria-label="Core Features">
            <div className="lumina-feature-cards-grid">
              {FEATURE_CARDS.map((card) => (
                <Link key={card.to} to={card.to} className="lumina-feature-card">
                  <h3 className="lumina-feature-card-title">{card.title}</h3>
                  <p className="lumina-feature-card-desc">{card.desc}</p>
                  <span className="lumina-feature-card-cta">Explore docs →</span>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        <Markdown content={activeContent} />

        <nav className="lumina-prev-next" aria-label="Documentation pagination">
          {prevPage ? (
            <Link to={prevPage.path} className="lumina-prev-next-card is-prev">
              <span className="lumina-prev-next-dir">← Previous</span>
              <span className="lumina-prev-next-title">{prevPage.navLabel}</span>
            </Link>
          ) : (
            <div />
          )}

          {nextPage ? (
            <Link to={nextPage.path} className="lumina-prev-next-card is-next">
              <span className="lumina-prev-next-dir">Next →</span>
              <span className="lumina-prev-next-title">{nextPage.navLabel}</span>
            </Link>
          ) : (
            <Link to="/lumina/posts" className="lumina-prev-next-card is-next">
              <span className="lumina-prev-next-dir">Next →</span>
              <span className="lumina-prev-next-title">Release Updates &amp; Posts</span>
            </Link>
          )}
        </nav>
      </article>
    </Shell>
  )
}
