import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useRouter } from '../../../core/router'
import { useIsAdmin } from '../../auth/useProfile'
import { FileIcon, PlusIcon, SparklesIcon } from '../../common/Icons'
import type { LuminaDocRecord } from '../api/docs'
import type { LuminaPost } from '../api/posts'
import type { LuminaReleaseInfo } from '../api/release'
import { DocModal } from './DocModal'
import { Header } from './Header'
import type { DocHeading } from './Markdown'
import { PostModal } from './PostModal'
import { Sidebar } from './Sidebar'
import { TableOfContents } from './TableOfContents'

export interface ShellProps {
  release: LuminaReleaseInfo
  headings?: DocHeading[]
  activeDocForEdit?: LuminaDocRecord | null
  onPostCreated?: (post: LuminaPost) => void
  onDocSaved?: (doc: LuminaDocRecord) => void
  children: ReactNode
}

export function Shell({
  release,
  headings = [],
  activeDocForEdit = null,
  onPostCreated,
  onDocSaved,
  children,
}: ShellProps) {
  const { path, navigate } = useRouter()
  const isAdmin = useIsAdmin()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [fabOpen, setFabOpen] = useState(false)
  const [creatingPost, setCreatingPost] = useState(false)
  const [creatingDoc, setCreatingDoc] = useState(false)
  const [editingActiveDoc, setEditingActiveDoc] = useState(false)
  const fabRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMobileNavOpen(false)
    setFabOpen(false)
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
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
        onToggleMobileNav={() => setMobileNavOpen((prev) => !prev)}
      />

      {mobileNavOpen ? (
        <div
          className="lumina-mobile-backdrop"
          onClick={() => setMobileNavOpen(false)}
          aria-hidden="true"
        />
      ) : null}

      <div className="lumina-layout">
        <Sidebar mobileOpen={mobileNavOpen} />

        <main className="lumina-main">
          <div className="lumina-main-inner">{children}</div>
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
                <span>Create Lumina Post</span>
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
            onDocSaved?.(saved)
          }}
        />
      ) : null}

      {editingActiveDoc && activeDocForEdit ? (
        <DocModal
          doc={activeDocForEdit}
          onClose={() => setEditingActiveDoc(false)}
          onSaved={(saved) => {
            onDocSaved?.(saved)
          }}
        />
      ) : null}
    </div>
  )
}
