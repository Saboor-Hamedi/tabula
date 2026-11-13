const SITE_ORIGIN = 'https://www.luminatabula.com'
const DEFAULT_IMAGE = `${SITE_ORIGIN}/logo.png`
const DEFAULT_TITLE = 'Lumina Tabula — Chat with your data'
const DEFAULT_DESC =
  'Private, in-browser data analysis. Upload a CSV or Excel file and get charts, SQL insights, and Python plots — your files never leave your device.'

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,120}$/

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function sanitizeImageUrl(raw) {
  if (typeof raw !== 'string') return DEFAULT_IMAGE
  const trimmed = raw.trim()
  if (!trimmed) return DEFAULT_IMAGE
  if (trimmed.startsWith('/')) {
    return `${SITE_ORIGIN}${trimmed}`
  }
  try {
    const parsed = new URL(trimmed)
    if (parsed.protocol === 'https:') {
      return parsed.toString()
    }
  } catch {
    // ignore invalid URLs
  }
  return DEFAULT_IMAGE
}

function renderHtml({ title, description, image, url, type = 'article' }) {
  const t = escapeHtml(title)
  const d = escapeHtml(description)
  const img = escapeHtml(image)
  const u = escapeHtml(url)
  const ogType = escapeHtml(type)

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>${t}</title>
    <meta name="description" content="${d}" />
    <link rel="canonical" href="${u}" />
    <meta property="og:type" content="${ogType}" />
    <meta property="og:site_name" content="Lumina Tabula" />
    <meta property="og:title" content="${t}" />
    <meta property="og:description" content="${d}" />
    <meta property="og:image" content="${img}" />
    <meta property="og:image:alt" content="${t}" />
    <meta property="og:url" content="${u}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${t}" />
    <meta name="twitter:description" content="${d}" />
    <meta name="twitter:image" content="${img}" />
  </head>
  <body>
    <main>
      <h1>${t}</h1>
      <p>${d}</p>
      <p><a href="${u}">Open on Lumina Tabula</a></p>
    </main>
  </body>
</html>`
}

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=3600')

  const rawSlug = Array.isArray(req.query?.slug) ? req.query.slug[0] : req.query?.slug
  const slug = typeof rawSlug === 'string' ? rawSlug.trim().toLowerCase() : ''

  if (!SLUG_RE.test(slug)) {
    res.status(200).send(
      renderHtml({
        title: DEFAULT_TITLE,
        description: DEFAULT_DESC,
        image: DEFAULT_IMAGE,
        url: `${SITE_ORIGIN}/posts`,
        type: 'website',
      }),
    )
    return
  }

  const canonicalUrl = `${SITE_ORIGIN}/posts/${encodeURIComponent(slug)}`
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY

  if (!supabaseUrl || !anonKey) {
    res.status(200).send(
      renderHtml({
        title: DEFAULT_TITLE,
        description: DEFAULT_DESC,
        image: DEFAULT_IMAGE,
        url: canonicalUrl,
      }),
    )
    return
  }

  try {
    const endpoint =
      `${supabaseUrl.replace(/\/+$/, '')}/rest/v1/posts` +
      `?select=title,subtitle,excerpt,cover_image_url,post_images(url,position)` +
      `&slug=eq.${encodeURIComponent(slug)}` +
      `&status=eq.published` +
      `&limit=1`

    const response = await fetch(endpoint, {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        Accept: 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(`Supabase REST returned ${response.status}`)
    }

    const rows = await response.json()
    const post = Array.isArray(rows) ? rows[0] : null

    if (!post) {
      res.status(200).send(
        renderHtml({
          title: DEFAULT_TITLE,
          description: DEFAULT_DESC,
          image: DEFAULT_IMAGE,
          url: canonicalUrl,
          type: 'website',
        }),
      )
      return
    }

    const gallery = Array.isArray(post.post_images)
      ? [...post.post_images].sort((a, b) => (a?.position ?? 0) - (b?.position ?? 0))
      : []

    const title = post.title ? `${post.title} — Lumina Tabula` : DEFAULT_TITLE
    const description =
      (typeof post.excerpt === 'string' && post.excerpt.trim()) ||
      (typeof post.subtitle === 'string' && post.subtitle.trim()) ||
      DEFAULT_DESC
    const image = sanitizeImageUrl(post.cover_image_url || gallery[0]?.url)

    res.status(200).send(
      renderHtml({
        title,
        description,
        image,
        url: canonicalUrl,
      }),
    )
  } catch {
    res.status(200).send(
      renderHtml({
        title: DEFAULT_TITLE,
        description: DEFAULT_DESC,
        image: DEFAULT_IMAGE,
        url: canonicalUrl,
      }),
    )
  }
}
