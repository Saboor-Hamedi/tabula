import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../../core/supabase/client'

export const LUMINA_GITHUB_OWNER = 'Saboor-Hamedi'
export const LUMINA_GITHUB_REPO = 'lumina'
export const LUMINA_REPO_URL = `https://github.com/${LUMINA_GITHUB_OWNER}/${LUMINA_GITHUB_REPO}`
export const LUMINA_RELEASES_URL = `${LUMINA_REPO_URL}/releases/latest`

export type LuminaPlatform = 'windows' | 'macos' | 'linux'

export interface LuminaInstallerAsset {
  name: string
  format: string
  label: string
  platform: LuminaPlatform
  url: string
  sizeBytes?: number
  isDirectBinary: boolean
}

export interface LuminaReleaseInfo {
  /** Dynamic version fetched from GitHub (`tag_name`), or null if not yet fetched. Never hardcoded. */
  version: string | null
  tagName: string | null
  releaseName: string | null
  publishedAt: string | null
  htmlUrl: string
  notes: string | null
  /** Live GitHub repository star count (`stargazers_count`), or null if not fetched yet. */
  stars: number | null
  loading: boolean
  source: 'github' | 'cache' | 'supabase' | 'shields' | 'fallback'
  windows: {
    exe: LuminaInstallerAsset
    msi: LuminaInstallerAsset
    primary: LuminaInstallerAsset
  }
  macos: {
    dmg: LuminaInstallerAsset
    primary: LuminaInstallerAsset
  }
  linux: {
    deb: LuminaInstallerAsset
    appImage: LuminaInstallerAsset
    primary: LuminaInstallerAsset
  }
  allAssets: LuminaInstallerAsset[]
}

interface GithubAssetPayload {
  name?: string
  browser_download_url?: string
  size?: number
}

interface GithubReleasePayload {
  tag_name?: string
  name?: string
  published_at?: string
  html_url?: string
  body?: string
  assets?: GithubAssetPayload[]
}

interface PersistedReleaseCache {
  ts: number
  etag?: string | null
  data: LuminaReleaseInfo
}

const STORAGE_KEY = 'lumina:release_cache:v3'
const FRESH_TTL_MS = 30 * 60 * 1000 // 30 minutes fresh
const STALE_MAX_MS = 7 * 24 * 60 * 60 * 1000 // 7 days stale fallback

let memoryCache: PersistedReleaseCache | null = null
let inflightPromise: Promise<LuminaReleaseInfo> | null = null

export function detectVisitorPlatform(): LuminaPlatform {
  if (typeof navigator === 'undefined') return 'windows'
  const ua = (navigator.userAgent || '').toLowerCase()
  const platform = (navigator.platform || '').toLowerCase()
  if (ua.includes('mac') || platform.includes('mac')) return 'macos'
  if (ua.includes('linux') || platform.includes('linux')) return 'linux'
  return 'windows'
}

export function formatBytes(bytes?: number): string | null {
  if (!bytes || !Number.isFinite(bytes) || bytes <= 0) return null
  const mb = bytes / (1024 * 1024)
  return `${mb.toFixed(1)} MB`
}

export function formatStarCount(stars: number | null | undefined): string | null {
  if (stars === null || stars === undefined || !Number.isFinite(stars) || stars < 0) {
    return null
  }
  if (stars >= 1000) {
    return `${(stars / 1000).toFixed(1).replace(/\.0$/, '')}k`
  }
  return String(Math.round(stars))
}

export function normalizeVersionLabel(tag: string | null | undefined): string | null {
  if (!tag) return null
  const clean = tag.trim().replace(/^release[-/\s]*/i, '')
  if (!clean || clean === 'none' || clean === 'unknown') return null
  if (!/^[vV]?\d+\.\d+/.test(clean)) return null
  return clean.startsWith('v') || clean.startsWith('V') ? `v${clean.slice(1)}` : `v${clean}`
}

function isSafeGithubUrl(url: string | undefined | null): boolean {
  if (!url) return false
  return (
    url.startsWith(`https://github.com/${LUMINA_GITHUB_OWNER}/${LUMINA_GITHUB_REPO}/`) ||
    url.startsWith('https://objects.githubusercontent.com/')
  )
}

export function buildEmptyRelease(loading = false): LuminaReleaseInfo {
  const winExe: LuminaInstallerAsset = {
    name: 'Lumina-Windows-x64-setup.exe',
    format: '.exe',
    label: 'Windows Installer (.exe)',
    platform: 'windows',
    url: LUMINA_RELEASES_URL,
    isDirectBinary: false,
  }
  const winMsi: LuminaInstallerAsset = {
    name: 'Lumina-Windows-x64.msi',
    format: '.msi',
    label: 'Windows MSI (.msi)',
    platform: 'windows',
    url: LUMINA_RELEASES_URL,
    isDirectBinary: false,
  }
  const macDmg: LuminaInstallerAsset = {
    name: 'Lumina-macOS-Universal.dmg',
    format: '.dmg',
    label: 'macOS Universal (.dmg)',
    platform: 'macos',
    url: LUMINA_RELEASES_URL,
    isDirectBinary: false,
  }
  const linuxDeb: LuminaInstallerAsset = {
    name: 'Lumina-Linux-amd64.deb',
    format: '.deb',
    label: 'Debian / Ubuntu (.deb)',
    platform: 'linux',
    url: LUMINA_RELEASES_URL,
    isDirectBinary: false,
  }
  const linuxAppImage: LuminaInstallerAsset = {
    name: 'Lumina-Linux-x86_64.AppImage',
    format: '.AppImage',
    label: 'Universal Linux (.AppImage)',
    platform: 'linux',
    url: LUMINA_RELEASES_URL,
    isDirectBinary: false,
  }

  return {
    version: null,
    tagName: null,
    releaseName: null,
    publishedAt: null,
    htmlUrl: LUMINA_RELEASES_URL,
    notes: null,
    stars: null,
    loading,
    source: 'fallback',
    windows: { exe: winExe, msi: winMsi, primary: winExe },
    macos: { dmg: macDmg, primary: macDmg },
    linux: { deb: linuxDeb, appImage: linuxAppImage, primary: linuxAppImage },
    allAssets: [winExe, winMsi, macDmg, linuxDeb, linuxAppImage],
  }
}

function parseGithubReleasePayload(
  payload: GithubReleasePayload,
  stars: number | null,
  source: LuminaReleaseInfo['source'] = 'github',
): LuminaReleaseInfo {
  const base = buildEmptyRelease(false)
  const tagName = payload.tag_name?.trim() || null
  const version = normalizeVersionLabel(tagName) ?? normalizeVersionLabel(payload.name)
  const htmlUrl = isSafeGithubUrl(payload.html_url) ? payload.html_url!.trim() : LUMINA_RELEASES_URL
  const rawAssets = Array.isArray(payload.assets) ? payload.assets : []

  let winExe: LuminaInstallerAsset = { ...base.windows.exe, url: htmlUrl }
  let winMsi: LuminaInstallerAsset = { ...base.windows.msi, url: htmlUrl }
  let macDmg: LuminaInstallerAsset = { ...base.macos.dmg, url: htmlUrl }
  let linuxDeb: LuminaInstallerAsset = { ...base.linux.deb, url: htmlUrl }
  let linuxAppImage: LuminaInstallerAsset = { ...base.linux.appImage, url: htmlUrl }

  const discovered: LuminaInstallerAsset[] = []

  for (const asset of rawAssets) {
    const name = asset.name?.trim() || ''
    const url = asset.browser_download_url?.trim() || ''
    if (!name || !isSafeGithubUrl(url)) continue
    const lower = name.toLowerCase()
    if (lower.endsWith('.sig') || lower.endsWith('.json') || lower.endsWith('.txt') || lower.endsWith('.sha256')) {
      continue
    }

    if (lower.endsWith('.exe')) {
      winExe = {
        name,
        format: '.exe',
        label: 'Windows Installer (.exe)',
        platform: 'windows',
        url,
        sizeBytes: asset.size,
        isDirectBinary: true,
      }
      discovered.push(winExe)
    } else if (lower.endsWith('.msi')) {
      winMsi = {
        name,
        format: '.msi',
        label: 'Windows MSI (.msi)',
        platform: 'windows',
        url,
        sizeBytes: asset.size,
        isDirectBinary: true,
      }
      discovered.push(winMsi)
    } else if (lower.endsWith('.dmg') || (lower.includes('darwin') && lower.endsWith('.tar.gz'))) {
      macDmg = {
        name,
        format: '.dmg',
        label: 'macOS Universal (.dmg)',
        platform: 'macos',
        url,
        sizeBytes: asset.size,
        isDirectBinary: true,
      }
      discovered.push(macDmg)
    } else if (lower.endsWith('.deb')) {
      linuxDeb = {
        name,
        format: '.deb',
        label: 'Debian / Ubuntu (.deb)',
        platform: 'linux',
        url,
        sizeBytes: asset.size,
        isDirectBinary: true,
      }
      discovered.push(linuxDeb)
    } else if (lower.endsWith('.appimage')) {
      linuxAppImage = {
        name,
        format: '.AppImage',
        label: 'Universal Linux (.AppImage)',
        platform: 'linux',
        url,
        sizeBytes: asset.size,
        isDirectBinary: true,
      }
      discovered.push(linuxAppImage)
    }
  }

  return {
    version,
    tagName: tagName ?? version,
    releaseName: payload.name?.trim() || version,
    publishedAt: payload.published_at || null,
    htmlUrl,
    notes: payload.body?.trim() || null,
    stars,
    loading: false,
    source,
    windows: {
      exe: winExe,
      msi: winMsi,
      primary: winExe.isDirectBinary ? winExe : winMsi.isDirectBinary ? winMsi : winExe,
    },
    macos: {
      dmg: macDmg,
      primary: macDmg,
    },
    linux: {
      deb: linuxDeb,
      appImage: linuxAppImage,
      primary: linuxAppImage.isDirectBinary
        ? linuxAppImage
        : linuxDeb.isDirectBinary
          ? linuxDeb
          : linuxAppImage,
    },
    allAssets:
      discovered.length > 0 ? discovered : [winExe, winMsi, macDmg, linuxDeb, linuxAppImage],
  }
}

async function fetchRepoStarCount(): Promise<number | null> {
  try {
    const res = await fetch(
      `https://api.github.com/repos/${LUMINA_GITHUB_OWNER}/${LUMINA_GITHUB_REPO}`,
      { headers: { Accept: 'application/vnd.github+json' } },
    )
    if (res.ok) {
      const data = (await res.json()) as { stargazers_count?: number }
      if (typeof data.stargazers_count === 'number') {
        return data.stargazers_count
      }
    }
  } catch {
    // Fall through to Shields CDN star count fallback
  }

  try {
    const res = await fetch(
      `https://img.shields.io/github/stars/${LUMINA_GITHUB_OWNER}/${LUMINA_GITHUB_REPO}.json`,
    )
    if (res.ok) {
      const data = (await res.json()) as { value?: string }
      const raw = (data.value || '').trim().toLowerCase()
      if (raw.endsWith('k')) {
        const num = parseFloat(raw.slice(0, -1))
        if (Number.isFinite(num)) return Math.round(num * 1000)
      }
      const parsed = parseInt(raw.replace(/[^0-9]/g, ''), 10)
      if (Number.isFinite(parsed)) return parsed
    }
  } catch {
    // Ignore fallback error
  }
  return null
}

function readLocalCache(): PersistedReleaseCache | null {
  if (memoryCache) return memoryCache
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as PersistedReleaseCache
    if (parsed && parsed.data && typeof parsed.ts === 'number') {
      memoryCache = parsed
      return parsed
    }
  } catch {
    // Ignore storage read errors
  }
  return null
}

function writeLocalCache(data: LuminaReleaseInfo, etag?: string | null): void {
  const entry: PersistedReleaseCache = {
    ts: Date.now(),
    etag: etag ?? memoryCache?.etag ?? null,
    data: { ...data, loading: false },
  }
  memoryCache = entry
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entry))
    } catch {
      // Ignore quota errors
    }
  }
}

function syncReleaseToSupabase(info: LuminaReleaseInfo): void {
  if (!supabase || !info.version || !info.tagName) return
  void supabase
    .rpc('lumina_cache_github_release', {
      p_tag_name: info.tagName,
      p_version: info.version,
      p_name: info.releaseName ?? info.version,
      p_html_url: info.htmlUrl,
      p_windows_exe_url: info.windows.exe.isDirectBinary ? info.windows.exe.url : null,
      p_windows_msi_url: info.windows.msi.isDirectBinary ? info.windows.msi.url : null,
      p_macos_dmg_url: info.macos.dmg.isDirectBinary ? info.macos.dmg.url : null,
      p_linux_deb_url: info.linux.deb.isDirectBinary ? info.linux.deb.url : null,
      p_linux_appimage_url: info.linux.appImage.isDirectBinary ? info.linux.appImage.url : null,
      p_published_at: info.publishedAt,
      p_stars_count: info.stars ?? 0,
    })
    .then(
      () => {},
      () => {},
    )
}

async function fetchReleaseFromSupabaseCache(): Promise<LuminaReleaseInfo | null> {
  if (!supabase) return null
  try {
    const { data, error } = await supabase
      .from('lumina_releases')
      .select('*')
      .eq('is_latest', true)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error || !data) return null
    const tag = (data.tag_name as string) || (data.version as string) || null
    const version = normalizeVersionLabel(tag)
    if (!version) return null

    const base = buildEmptyRelease(false)
    const htmlUrl = isSafeGithubUrl(data.html_url as string)
      ? (data.html_url as string)
      : LUMINA_RELEASES_URL

    if (isSafeGithubUrl(data.windows_exe_url as string)) {
      base.windows.exe.url = data.windows_exe_url as string
      base.windows.exe.isDirectBinary = true
    }
    if (isSafeGithubUrl(data.windows_msi_url as string)) {
      base.windows.msi.url = data.windows_msi_url as string
      base.windows.msi.isDirectBinary = true
    }
    if (isSafeGithubUrl(data.macos_dmg_url as string)) {
      base.macos.dmg.url = data.macos_dmg_url as string
      base.macos.dmg.isDirectBinary = true
    }
    if (isSafeGithubUrl(data.linux_deb_url as string)) {
      base.linux.deb.url = data.linux_deb_url as string
      base.linux.deb.isDirectBinary = true
    }
    if (isSafeGithubUrl(data.linux_appimage_url as string)) {
      base.linux.appImage.url = data.linux_appimage_url as string
      base.linux.appImage.isDirectBinary = true
    }

    return {
      ...base,
      version,
      tagName: tag,
      releaseName: (data.name as string) || version,
      publishedAt: (data.published_at as string) || null,
      htmlUrl,
      notes: (data.notes as string) || null,
      stars: typeof data.stars_count === 'number' ? data.stars_count : null,
      loading: false,
      source: 'supabase',
    }
  } catch {
    return null
  }
}

async function fetchVersionFromShieldsCdn(stars: number | null): Promise<LuminaReleaseInfo | null> {
  try {
    const res = await fetch(
      `https://img.shields.io/github/v/release/${LUMINA_GITHUB_OWNER}/${LUMINA_GITHUB_REPO}.json?include_prereleases`,
    )
    if (!res.ok) return null
    const json = (await res.json()) as { value?: string }
    const version = normalizeVersionLabel(json.value)
    if (!version) return null
    const base = buildEmptyRelease(false)
    return {
      ...base,
      version,
      tagName: version,
      releaseName: version,
      stars,
      loading: false,
      source: 'shields',
    }
  } catch {
    return null
  }
}

export async function fetchLuminaLatestRelease(forceRefresh = false): Promise<LuminaReleaseInfo> {
  const cached = readLocalCache()
  const now = Date.now()

  if (!forceRefresh && cached && now - cached.ts < FRESH_TTL_MS && cached.data.version) {
    return { ...cached.data, loading: false, source: 'cache' }
  }

  if (inflightPromise && !forceRefresh) {
    return inflightPromise
  }

  const run = async (): Promise<LuminaReleaseInfo> => {
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
    }
    if (!forceRefresh && cached?.etag) {
      headers['If-None-Match'] = cached.etag
    }

    const starsPromise = fetchRepoStarCount()

    try {
      const res = await fetch(
        `https://api.github.com/repos/${LUMINA_GITHUB_OWNER}/${LUMINA_GITHUB_REPO}/releases/latest`,
        { headers },
      )

      const stars = (await starsPromise) ?? cached?.data?.stars ?? null

      if (res.status === 304 && cached?.data) {
        const refreshed = { ...cached.data, stars: stars ?? cached.data.stars }
        writeLocalCache(refreshed, cached.etag)
        return { ...refreshed, loading: false, source: 'cache' }
      }

      if (res.ok) {
        const etag = res.headers.get('etag')
        const data = (await res.json()) as GithubReleasePayload
        const parsed = parseGithubReleasePayload(data, stars, 'github')
        if (parsed.version) {
          writeLocalCache(parsed, etag)
          syncReleaseToSupabase(parsed)
          return parsed
        }
      }

      if (res.status === 404) {
        const listRes = await fetch(
          `https://api.github.com/repos/${LUMINA_GITHUB_OWNER}/${LUMINA_GITHUB_REPO}/releases?per_page=1`,
          { headers: { Accept: 'application/vnd.github+json' } },
        )
        if (listRes.ok) {
          const list = (await listRes.json()) as GithubReleasePayload[]
          if (Array.isArray(list) && list.length > 0) {
            const parsed = parseGithubReleasePayload(list[0], stars, 'github')
            if (parsed.version) {
              writeLocalCache(parsed, listRes.headers.get('etag'))
              syncReleaseToSupabase(parsed)
              return parsed
            }
          }
        }

        const tagsRes = await fetch(
          `https://api.github.com/repos/${LUMINA_GITHUB_OWNER}/${LUMINA_GITHUB_REPO}/tags?per_page=1`,
          { headers: { Accept: 'application/vnd.github+json' } },
        )
        if (tagsRes.ok) {
          const tags = (await tagsRes.json()) as Array<{ name?: string }>
          if (Array.isArray(tags) && tags.length > 0 && tags[0].name) {
            const parsed = parseGithubReleasePayload(
              {
                tag_name: tags[0].name,
                name: tags[0].name,
                html_url: LUMINA_RELEASES_URL,
              },
              stars,
              'github',
            )
            if (parsed.version) {
              writeLocalCache(parsed)
              syncReleaseToSupabase(parsed)
              return parsed
            }
          }
        }
      }
    } catch {
      // Network or rate limit error — fall through to multi-tier fallbacks
    }

    const stars = (await starsPromise) ?? cached?.data?.stars ?? null

    const dbRelease = await fetchReleaseFromSupabaseCache()
    if (dbRelease && dbRelease.version) {
      const merged = { ...dbRelease, stars: stars ?? dbRelease.stars }
      writeLocalCache(merged)
      return merged
    }

    if (cached && now - cached.ts < STALE_MAX_MS && cached.data.version) {
      return {
        ...cached.data,
        stars: stars ?? cached.data.stars,
        loading: false,
        source: 'cache',
      }
    }

    const shieldsRelease = await fetchVersionFromShieldsCdn(stars)
    if (shieldsRelease && shieldsRelease.version) {
      writeLocalCache(shieldsRelease)
      return shieldsRelease
    }

    const empty = buildEmptyRelease(false)
    return { ...empty, stars }
  }

  inflightPromise = run().finally(() => {
    inflightPromise = null
  })

  return inflightPromise
}

export function recordLuminaDownload(asset: LuminaInstallerAsset, version: string | null): void {
  if (!supabase) return
  void supabase
    .rpc('lumina_record_download', {
      p_platform: asset.platform,
      p_installer_format: asset.format,
      p_version: version ?? 'latest',
      p_download_url: asset.url,
    })
    .then(
      () => {},
      () => {},
    )
}

export function useLuminaRelease(): LuminaReleaseInfo & { refresh: () => Promise<void> } {
  const [release, setRelease] = useState<LuminaReleaseInfo>(() => {
    const cached = readLocalCache()
    return cached?.data ? { ...cached.data, loading: false } : buildEmptyRelease(true)
  })

  useEffect(() => {
    let active = true
    fetchLuminaLatestRelease(false).then((info) => {
      if (active) setRelease(info)
    })
    return () => {
      active = false
    }
  }, [])

  const refresh = useCallback(async () => {
    setRelease((prev) => ({ ...prev, loading: true }))
    const fresh = await fetchLuminaLatestRelease(true)
    setRelease(fresh)
  }, [])

  return { ...release, refresh }
}
