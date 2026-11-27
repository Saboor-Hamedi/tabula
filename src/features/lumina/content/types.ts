import type { LuminaDocSection } from '../api/docs'

export interface LuminaDocPageDef {
  slug: string
  path: string
  section: LuminaDocSection
  title: string
  navLabel: string
  subtitle: string
  summary: string
  sortOrder: number
  content: string
  /** True for static reference pages (shortcuts, installation shell, OAuth legal baselines). */
  isStaticBaseline?: boolean
}

export interface LuminaSidebarGroup {
  group: LuminaDocSection
  items: Array<{
    label: string
    to: string
    slug?: string
  }>
}
