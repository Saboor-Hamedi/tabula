import { FEATURES_DOCS } from './features'
import { LEGAL_DOCS } from './legal'
import { PROLOGUE_DOCS } from './prologue'
import { LUMINA_SHORTCUTS, REFERENCE_DOCS } from './reference'
import type { LuminaDocPageDef, LuminaSidebarGroup } from './types'

export type { LuminaDocPageDef, LuminaSidebarGroup }
export { LUMINA_SHORTCUTS }

export const LUMINA_DOC_PAGES: LuminaDocPageDef[] = [
  ...PROLOGUE_DOCS,
  ...FEATURES_DOCS,
  ...REFERENCE_DOCS,
  ...LEGAL_DOCS,
]

export const LUMINA_SIDEBAR_GROUPS: LuminaSidebarGroup[] = [
  {
    group: 'Prologue',
    items: [
      { label: 'Overview', to: '/lumina' },
      { label: 'Download & Installation', to: '/lumina/installation' },
      { label: 'Release Updates & Posts', to: '/lumina/posts' },
    ],
  },
  {
    group: 'Features',
    items: [
      { label: 'All Features Overview', to: '/lumina/features' },
      { label: 'Markdown Editor & Split Panes', to: '/lumina/features/editor' },
      { label: 'Infinite Canvas (.canvas)', to: '/lumina/features/canvas' },
      { label: '2D & 3D Knowledge Graph', to: '/lumina/features/graph' },
      { label: 'AI Copilot & Local Models', to: '/lumina/features/ai-copilot' },
      { label: 'Integrated Terminal (ConPTY/PTY)', to: '/lumina/features/terminal' },
      { label: 'Exports & 50 Themes', to: '/lumina/features/exports' },
      { label: 'Google Drive & Gmail Sync', to: '/lumina/features/google-sync' },
    ],
  },
  {
    group: 'Reference',
    items: [
      { label: 'Keyboard Shortcuts', to: '/lumina/shortcuts' },
      { label: 'Architecture & Tech Stack', to: '/lumina/architecture' },
      { label: 'Build from Source', to: '/lumina/build' },
    ],
  },
  {
    group: 'Legal',
    items: [
      { label: 'Privacy Policy', to: '/lumina/privacy' },
      { label: 'Terms of Service', to: '/lumina/terms' },
    ],
  },
]

export function findLuminaDocByPath(pathname: string): LuminaDocPageDef | null {
  const clean = pathname.replace(/\/+$/, '') || '/lumina'
  return LUMINA_DOC_PAGES.find((page) => page.path === clean) ?? null
}

export function findLuminaDocBySlug(slug: string): LuminaDocPageDef | null {
  return LUMINA_DOC_PAGES.find((page) => page.slug === slug) ?? null
}
