import type { LuminaDocRecord, LuminaDocSection } from '../api/docs'
import { LEGAL_DOCS } from './legal'
import { LUMINA_SHORTCUTS, SHORTCUTS_DOC } from './reference'
import type { LuminaDocPageDef, LuminaSidebarGroup } from './types'

export type { LuminaDocPageDef, LuminaSidebarGroup }
export { LUMINA_SHORTCUTS }

/**
 * Only static baseline routes that don't need to be rewritten constantly:
 * - `/lumina` (shell route — content comes from `public.lumina_docs` slug `overview`)
 * - `/lumina/installation` (live GitHub multi-OS installer download shell + optional DB content)
 * - `/lumina/shortcuts` (static keyboard shortcuts table)
 * - `/lumina/privacy` & `/lumina/terms` (Google Cloud Console OAuth required legal pages, overridable via DB)
 *
 * All other documentation pages (Overview prose, Features, Architecture, Guides, etc.)
 * are 100% database-driven from `public.lumina_docs` via the CRUD modal!
 */
export const STATIC_BASELINE_DOCS: LuminaDocPageDef[] = [
  {
    slug: 'overview',
    path: '/lumina',
    section: 'Prologue',
    title: 'Lumina',
    navLabel: 'Overview',
    subtitle: '',
    summary: '',
    sortOrder: 10,
    isStaticBaseline: false,
    content: '',
  },
  {
    slug: 'installation',
    path: '/lumina/installation',
    section: 'Prologue',
    title: 'Download & Installation',
    navLabel: 'Download & Installation',
    subtitle: 'Official native desktop installers fetched dynamically from GitHub Releases.',
    summary: 'Download Lumina for Windows, macOS, and Linux.',
    sortOrder: 20,
    isStaticBaseline: true,
    content: '',
  },
  SHORTCUTS_DOC,
  ...LEGAL_DOCS.map((d) => ({ ...d, isStaticBaseline: true })),
]

export const LUMINA_DOC_PAGES = STATIC_BASELINE_DOCS

export function docSlugToPath(slug: string): string {
  if (slug === 'overview') return '/lumina'
  return `/lumina/${slug}`
}

export function pathToDocSlug(pathname: string): string {
  const clean = pathname.replace(/\/+$/, '') || '/lumina'
  if (clean === '/lumina') return 'overview'
  const prefix = '/lumina/'
  if (clean.startsWith(prefix)) {
    return clean.slice(prefix.length).replace(/\//g, '-')
  }
  return 'overview'
}

export function findLuminaDocByPath(pathname: string): LuminaDocPageDef | null {
  const clean = pathname.replace(/\/+$/, '') || '/lumina'
  const exact = STATIC_BASELINE_DOCS.find((page) => page.path === clean)
  if (exact) return exact
  const slug = pathToDocSlug(clean)
  return STATIC_BASELINE_DOCS.find((page) => page.slug === slug) ?? null
}

export function findLuminaDocBySlug(slug: string): LuminaDocPageDef | null {
  return STATIC_BASELINE_DOCS.find((page) => page.slug === slug) ?? null
}

/**
 * Dynamically builds the left sidebar navigation groups by combining the core
 * routes with all published documentation pages stored in `public.lumina_docs`.
 */
export function buildSidebarGroups(
  dbDocsMap: Record<string, LuminaDocRecord>,
): LuminaSidebarGroup[] {
  const sections: Record<LuminaDocSection, Array<{ label: string; to: string; order: number; slug?: string }>> = {
    Prologue: [
      { label: dbDocsMap.overview?.title || 'Overview', to: '/lumina', order: 10, slug: 'overview' },
      { label: 'Download & Installation', to: '/lumina/installation', order: 20, slug: 'installation' },
      { label: 'Release Updates & Posts', to: '/lumina/posts', order: 25 },
    ],
    Features: [],
    Reference: [
      { label: 'Keyboard Shortcuts', to: '/lumina/shortcuts', order: 40, slug: 'shortcuts' },
    ],
    Legal: [
      { label: 'Privacy Policy', to: '/lumina/privacy', order: 70, slug: 'privacy' },
      { label: 'Terms of Service', to: '/lumina/terms', order: 80, slug: 'terms' },
    ],
  }

  const fixedSlugs = new Set(['overview', 'installation', 'shortcuts', 'privacy', 'terms'])

  for (const doc of Object.values(dbDocsMap)) {
    if (!doc || !doc.slug || fixedSlugs.has(doc.slug)) continue
    const sec: LuminaDocSection =
      doc.section === 'Prologue' ||
      doc.section === 'Features' ||
      doc.section === 'Reference' ||
      doc.section === 'Legal'
        ? doc.section
        : 'Features'
    sections[sec].push({
      label: doc.title,
      to: docSlugToPath(doc.slug),
      order: doc.sort_order ?? 100,
      slug: doc.slug,
    })
  }

  const orderedGroups: LuminaDocSection[] = ['Prologue', 'Features', 'Reference', 'Legal']
  return orderedGroups
    .map((group) => ({
      group,
      items: sections[group]
        .sort((a, b) => a.order - b.order)
        .map(({ label, to, slug }) => ({ label, to, slug })),
    }))
    .filter((g) => g.items.length > 0)
}
