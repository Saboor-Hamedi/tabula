import { describe, expect, it } from 'vitest'
import {
  extractDocHeadings,
  sanitizeHref,
  sanitizeMarkdownInput,
} from './components/Markdown'
import {
  buildSidebarGroups,
  docSlugToPath,
  findLuminaDocByPath,
  LUMINA_SHORTCUTS,
  pathToDocSlug,
} from './content'
import { deriveMarkdownSummary, slugifyLuminaTitle } from './api/posts'
import {
  detectVisitorPlatform,
  formatBytes,
  formatStarCount,
  normalizeVersionLabel,
} from './api/release'

describe('Lumina documentation, security & release utilities', () => {
  it('resolves static baseline routes and dynamic doc slugs without hardcoded overview prose', () => {
    const overview = findLuminaDocByPath('/lumina')
    expect(overview?.slug).toBe('overview')
    expect(overview?.content).toBe('')
    expect(findLuminaDocByPath('/lumina/installation')?.slug).toBe('installation')
    expect(findLuminaDocByPath('/lumina/shortcuts')?.slug).toBe('shortcuts')
    expect(findLuminaDocByPath('/lumina/privacy')?.slug).toBe('privacy')
    expect(findLuminaDocByPath('/lumina/terms')?.slug).toBe('terms')
    expect(pathToDocSlug('/lumina/custom-guide')).toBe('custom-guide')
    expect(docSlugToPath('overview')).toBe('/lumina')
    expect(docSlugToPath('custom-guide')).toBe('/lumina/custom-guide')
  })

  it('dynamically injects database docs into sidebar navigation groups', () => {
    const groups = buildSidebarGroups({
      'rust-core': {
        slug: 'rust-core',
        section: 'Features',
        title: 'Rust Core Engine',
        subtitle: 'Rayon multithreaded indexing',
        summary: null,
        content: '## Rust Core',
        sort_order: 15,
        published: true,
      },
    })
    const featuresGroup = groups.find((g) => g.group === 'Features')
    expect(featuresGroup?.items).toEqual([
      { label: 'Rust Core Engine', to: '/lumina/rust-core', slug: 'rust-core' },
    ])
  })

  it('includes Google API Services User Data Policy Limited Use disclosure in privacy policy', () => {
    const privacy = findLuminaDocByPath('/lumina/privacy')
    expect(privacy).not.toBeNull()
    expect(privacy?.content).toContain('Google API Services User Data Policy')
    expect(privacy?.content).toContain('Limited Use requirements')
    expect(privacy?.content).toContain('saboorhamedi49@gmail.com')
  })

  it('includes all 12 keyboard shortcuts in the static shortcuts baseline', () => {
    expect(LUMINA_SHORTCUTS).toHaveLength(12)
  })

  it('extracts h2 and h3 headings for On This Page TOC while ignoring code blocks', () => {
    const md = [
      '## First Section',
      'Some text',
      '```bash',
      '## Not a heading',
      '```',
      '### Sub Section',
    ].join('\n')
    const headings = extractDocHeadings(md)
    expect(headings).toEqual([
      { id: 'first-section', text: 'First Section', level: 2 },
      { id: 'sub-section', text: 'Sub Section', level: 3 },
    ])
  })

  it('blocks unsafe javascript:, data:, <script>, and inline event handlers', () => {
    expect(sanitizeHref('javascript:alert(1)')).toBe('#')
    expect(sanitizeHref('data:text/html,<script>')).toBe('#')
    expect(sanitizeHref('https://github.com/Saboor-Hamedi/lumina')).toBe(
      'https://github.com/Saboor-Hamedi/lumina',
    )
    expect(
      sanitizeMarkdownInput('Hello <script>alert(1)</script> <img onerror="evil()" />'),
    ).not.toContain('<script>')
    expect(
      sanitizeMarkdownInput('Hello <script>alert(1)</script> <img onerror="evil()" />'),
    ).not.toContain('onerror=')
  })

  it('normalizes dynamic GitHub version tags, star counts, and slugs cleanly', () => {
    expect(normalizeVersionLabel('2.4.0')).toBe('v2.4.0')
    expect(normalizeVersionLabel('v2.4.0')).toBe('v2.4.0')
    expect(normalizeVersionLabel('invalid')).toBeNull()
    expect(slugifyLuminaTitle('Lumina Release: 3D Knowledge Graph!')).toBe(
      'lumina-release-3d-knowledge-graph',
    )
    expect(deriveMarkdownSummary('## Heading\n\n**Lumina** is a fast desktop app.')).toBe(
      'Lumina is a fast desktop app.',
    )
    expect(formatBytes(15 * 1024 * 1024)).toBe('15.0 MB')
    expect(formatStarCount(42)).toBe('42')
    expect(formatStarCount(1250)).toBe('1.3k')
    expect(formatStarCount(null)).toBeNull()
    expect(['windows', 'macos', 'linux']).toContain(detectVisitorPlatform())
  })
})
