import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useQuery, useRouter } from '../../../core/router'
import { useIsAdmin } from '../../auth/useProfile'
import { CheckIcon, FileIcon, PlusIcon, SparklesIcon } from '../../common/Icons'
import { fetchLuminaDocsMap, type LuminaDocRecord } from '../api/docs'
import type { LuminaPost } from '../api/posts'
import type { LuminaReleaseInfo } from '../api/release'
import { docSlugToPath } from '../content'
import { DocModal } from './DocModal'
import { DonationModal } from './DonationModal'
import { Header } from './Header'
import type { DocHeading } from './Markdown'
import { PostModal } from './PostModal'
import { Sidebar } from './Sidebar'
import { MobileInlineToc, TableOfContents } from './TableOfContents'

export interface ShellProps {
  release: LuminaReleaseInfo
  headings?: DocHeading[]
  dbDocsMap?: Record<string, LuminaDocRecord>
  activeDocForEdit?: LuminaDocRecord | null
  onPostCreated?: (post: LuminaPost) => void
  onDocSaved?: (doc: LuminaDocRecord) => void
  children: ReactNode
}

export function Shell({
  release,
  headings = [],
  dbDocsMap: externalDocsMap,
  activeDocForEdit = null,
  onPostCreated,
  onDocSaved,
  children,
}: ShellProps) {
  const { path, navigate } = useRouter()
  const query = useQuery()
  const isAdmin = useIsAdmin()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [donateOpen, setDonateOpen] = useState(false)
  const [internalDocsMap, setInternalDocsMap] = useState<Record<string, LuminaDocRecord>>({})
  const [fabOpen, setFabOpen] = useState(false)
  const [creatingPost, setCreatingPost] = useState(false)
  const [creatingDoc, setCreatingDoc] = useState(false)
  const [editingActiveDoc, setEditingActiveDoc] = useState(false)
  const fabRef = useRef<HTMLDivElement>(null)

  const donationSuccess = query.get('donation') === 'success'
  const effectiveDocsMap = externalDocsMap ?? internalDocsMap

  useEffect(() => {
    if (externalDocsMap) return
    let mounted = true
    fetchLuminaDocsMap().then((map) => {
      if (mounted) setInternalDocsMap(map)
    })
    return () => {
      mounted = false
    }
  }, [externalDocsMap])

  useEffect(() => {
    setMobileNavOpen(false)
    setFabOpen(false)
    window.scrollTo(0, 0)
  }, [path])

  useEffect(() => {
    if (!fabOpen) return
    const onPointerDown = (e: MouseEvent) => {
      if (fabRef.current && !fabRef.current.contains(e.target as Node)) {
        setFabOpen(false)
      }
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFabOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [fabOpen])

  return (
    <div className="lumina-docs-root">
      <Header
        release={release}
        dbDocsMap={effectiveDocsMap}
        onToggleMobileNav={() => setMobileNavOpen((prev) => !prev)}
        onOpenDonate={() => setDonateOpen(true)}
      />

      {mobileNavOpen ? (
        <div
          className="lumina-mobile-backdrop"
          onClick={() => setMobileNavOpen(false)}
          aria-hidden="true"
        />
      ) : null}

      <div className="lumina-layout">
        <Sidebar mobileOpen={mobileNavOpen} dbDocsMap={effectiveDocsMap} />

        <main className="lumina-main">
          <div className="lumina-main-inner">
            {donationSuccess ? (
              <div className="lumina-callout is-tip" style={{ marginTop: 0, marginBottom: 20 }}>
                <div className="lumina-callout-badge">
                  <CheckIcon size={12} /> THANK YOU FOR SUPPORTING LUMINA
                </div>
                <div className="lumina-callout-body">
                  Your contribution directly supports Lumina’s open-source Rust &amp; Tauri development!
                </div>
              </div>
            ) : null}
            <MobileInlineToc headings={headings} />
            {children}
          </div>
        </main>

        <TableOfContents headings={headings} />
      </div>

      {/* Small Bottom-Right Floating CRUD Action Button (Admin Only) */}
      {isAdmin ? (
        <div className="lumina-fab-wrap" ref={fabRef}>
          {fabOpen ? (
            <div className="lumina-fab-menu" role="menu">
              <button
                type="button"
                className="lumina-fab-menu-item"
                role="menuitem"
                onClick={() => {
                  setFabOpen(false)
                  setCreatingPost(true)
                }}
              >
                <SparklesIcon size={13} />
                <span>Write a Post</span>
              </button>

              {activeDocForEdit ? (
                <button
                  type="button"
                  className="lumina-fab-menu-item"
                  role="menuitem"
                  onClick={() => {
                    setFabOpen(false)
                    setEditingActiveDoc(true)
                  }}
                >
                  <FileIcon size={13} />
                  <span>Edit This Doc Page</span>
                </button>
              ) : null}

              <button
                type="button"
                className="lumina-fab-menu-item"
                role="menuitem"
                onClick={() => {
                  setFabOpen(false)
                  setCreatingDoc(true)
                }}
              >
                <PlusIcon size={13} />
                <span>New Documentation Page</span>
              </button>
            </div>
          ) : null}

          <button
            type="button"
            className={`lumina-fab-btn ${fabOpen ? 'is-open' : ''}`}
            onClick={() => setFabOpen((prev) => !prev)}
            aria-expanded={fabOpen}
            aria-label="Create Lumina post or documentation"
            title="Create Lumina post or documentation"
          >
            <PlusIcon size={15} />
          </button>
        </div>
      ) : null}

      <DonationModal open={donateOpen} onClose={() => setDonateOpen(false)} />

      {creatingPost ? (
        <PostModal
          mode="create"
          defaultVersion={release.version}
          onClose={() => setCreatingPost(false)}
          onSaved={(saved) => {
            onPostCreated?.(saved)
            navigate(`/lumina/posts/${saved.slug}`)
          }}
        />
      ) : null}

      {creatingDoc ? (
        <DocModal
          doc={null}
          onClose={() => setCreatingDoc(false)}
          onSaved={(saved) => {
            setInternalDocsMap((prev) => ({ ...prev, [saved.slug]: saved }))
            onDocSaved?.(saved)
            navigate(docSlugToPath(saved.slug))
          }}
        />
      ) : null}

      {editingActiveDoc && activeDocForEdit ? (
        <DocModal
          doc={activeDocForEdit}
          onClose={() => setEditingActiveDoc(false)}
          onSaved={(saved) => {
            setInternalDocsMap((prev) => ({ ...prev, [saved.slug]: saved }))
            onDocSaved?.(saved)
          }}
        />
      ) : null}
    </div>
  )
}
