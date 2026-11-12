/**
 * The front page navigation.
 *
 * The menu is data, not markup. Each entry owns its columns, so adding a
 * section is a one-line change and the header stays consistent.
 */

export interface MenuLink {
  label: string
  description?: string
  to: string
}

export interface MenuColumn {
  title: string
  links: MenuLink[]
}

export interface MenuFeatured {
  eyebrow: string
  title: string
  text: string
  to: string
  cta: string
}

export interface MenuEntry {
  id: string
  label: string
  columns: MenuColumn[]
  featured?: MenuFeatured
}

export const MENU: MenuEntry[] = [
  {
    id: 'product',
    label: 'Product',
    columns: [
      {
        title: 'Analyse',
        links: [
          {
            label: 'Workspace',
            description: 'Load a sheet and ask questions in English.',
            to: '#/workspace',
          },
          {
            label: 'Insights',
            description: 'Published answers with their charts intact.',
            to: '#/insights',
          },
          {
            label: 'Your dashboard',
            description: 'Datasets, questions and account details.',
            to: '#/app',
          },
        ],
      },
      {
        title: 'Capabilities',
        links: [
          {
            label: 'On-device SQL',
            description: 'DuckDB WASM over millions of rows.',
            to: '#/landing',
          },
          {
            label: 'Python notebooks',
            description: 'Pyodide, executed in the browser.',
            to: '#/landing',
          },
          {
            label: 'Charts & diagrams',
            description: 'Mermaid, series and elbow figures.',
            to: '#/landing',
          },
          {
            label: 'Word-ready exports',
            description: 'Tables, PDFs and transcripts.',
            to: '#/landing',
          },
        ],
      },
    ],
    featured: {
      eyebrow: 'Privacy',
      title: 'Your file never leaves the browser',
      text: 'Every calculation runs on your own device. Nothing is uploaded, stored or tracked.',
      to: '#/landing',
      cta: 'See how it works',
    },
  },
  {
    id: 'company',
    label: 'Company',
    columns: [
      {
        title: 'About',
        links: [
          { label: 'Product tour', to: '#/landing' },
          { label: 'Comparison', to: '#/landing' },
          { label: 'Pricing', to: '#/landing' },
        ],
      },
      {
        title: 'Support',
        links: [
          { label: 'Frequently asked questions', to: '#/landing' },
          { label: 'Contact', to: '#/landing' },
          { label: 'Status', to: '#/landing' },
        ],
      },
    ],
    featured: {
      eyebrow: 'Latest',
      title: 'Answers worth keeping',
      text: 'Browse the analyses our team has published from the workspace.',
      to: '#/insights',
      cta: 'Browse insights',
    },
  },
  {
    id: 'resources',
    label: 'Resources',
    columns: [
      {
        title: 'Learn',
        links: [
          { label: 'How on-device analysis works', to: '#/landing' },
          { label: 'Writing better questions', to: '#/landing' },
          { label: 'Reading a chart', to: '#/landing' },
        ],
      },
      {
        title: 'Tools',
        links: [
          { label: 'CSV viewer', to: '#/landing' },
          { label: 'Excel reader', to: '#/landing' },
          { label: 'SQL sandbox', to: '#/landing' },
        ],
      },
    ],
  },
]

export interface FooterColumn {
  title: string
  items: string[]
}

export const FOOTER_COLUMNS: FooterColumn[] = [
  {
    title: 'Navigation',
    items: ['Demo', 'Privacy', 'Pricing', 'FAQ'],
  },
  {
    title: 'Privacy Promise',
    items: ['100% On-Device', 'Zero Cloud Storage', 'No Telemetry', 'Never Saved'],
  },
]
