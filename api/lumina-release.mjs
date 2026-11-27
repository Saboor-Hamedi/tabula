/**
 * Vercel Serverless Function: `/api/lumina-release`
 *
 * Fetches repository star count (`stargazers_count`) and the latest release/tag
 * + multi-platform installer assets for `Saboor-Hamedi/lumina` on the server side,
 * with Vercel Edge CDN caching (`s-maxage=600, stale-while-revalidate=86400`) so
 * production visitors never hit browser CSP blocks or GitHub's 60 req/hr IP limit.
 */

const OWNER = 'Saboor-Hamedi'
const REPO = 'lumina'
const REPO_URL = `https://github.com/${OWNER}/${REPO}`
const RELEASES_URL = `${REPO_URL}/releases/latest`

const GH_HEADERS = {
  Accept: 'application/vnd.github+json',
  'User-Agent': 'LuminaTabula-ReleaseFetcher/1.0',
}

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=86400')

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const token = (process.env.GITHUB_TOKEN || '').trim()
  const headers = token
    ? { ...GH_HEADERS, Authorization: `Bearer ${token}` }
    : GH_HEADERS

  let stars = null
  let releasePayload = null

  try {
    const [repoRes, latestRes] = await Promise.all([
      fetch(`https://api.github.com/repos/${OWNER}/${REPO}`, { headers }).catch(() => null),
      fetch(`https://api.github.com/repos/${OWNER}/${REPO}/releases/latest`, { headers }).catch(
        () => null,
      ),
    ])

    if (repoRes && repoRes.ok) {
      const repoJson = await repoRes.json()
      if (typeof repoJson?.stargazers_count === 'number') {
        stars = repoJson.stargazers_count
      }
    }

    if (latestRes && latestRes.ok) {
      releasePayload = await latestRes.json()
    } else {
      // Fallback 1: `/releases?per_page=1` (includes pre-releases)
      const listRes = await fetch(
        `https://api.github.com/repos/${OWNER}/${REPO}/releases?per_page=1`,
        { headers },
      ).catch(() => null)
      if (listRes && listRes.ok) {
        const listJson = await listRes.json()
        if (Array.isArray(listJson) && listJson.length > 0) {
          releasePayload = listJson[0]
        }
      }

      // Fallback 2: `/tags?per_page=1`
      if (!releasePayload) {
        const tagsRes = await fetch(
          `https://api.github.com/repos/${OWNER}/${REPO}/tags?per_page=1`,
          { headers },
        ).catch(() => null)
        if (tagsRes && tagsRes.ok) {
          const tagsJson = await tagsRes.json()
          if (Array.isArray(tagsJson) && tagsJson.length > 0 && tagsJson[0]?.name) {
            releasePayload = {
              tag_name: tagsJson[0].name,
              name: tagsJson[0].name,
              html_url: RELEASES_URL,
              assets: [],
            }
          }
        }
      }
    }

    // Fallback for stars via Shields.io CDN if GitHub API was rate-limited
    if (stars === null) {
      const shieldsRes = await fetch(
        `https://img.shields.io/github/stars/${OWNER}/${REPO}.json`,
      ).catch(() => null)
      if (shieldsRes && shieldsRes.ok) {
        const sJson = await shieldsRes.json()
        const raw = String(sJson?.value ?? '').trim().toLowerCase()
        if (raw.endsWith('k')) {
          const n = parseFloat(raw.slice(0, -1))
          if (Number.isFinite(n)) stars = Math.round(n * 1000)
        } else {
          const n = parseInt(raw.replace(/[^0-9]/g, ''), 10)
          if (Number.isFinite(n)) stars = n
        }
      }
    }
  } catch {
    // Fall through cleanly
  }

  res.status(200).json({
    ok: true,
    stars: typeof stars === 'number' ? stars : 0,
    release: releasePayload,
  })
}
