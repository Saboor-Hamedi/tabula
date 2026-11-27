import { useEffect, useMemo, useState } from 'react'
import { Link, useRouter } from '../../../core/router'
import { useIsAdmin } from '../../auth/useProfile'
import { PencilIcon, SearchIcon, TrashIcon } from '../../common/Icons'
import { fetchLuminaDocsMap, type LuminaDocRecord } from '../api/docs'
import {
  buildLuminaPostTree,
  deleteLuminaPost,
  listLuminaPosts,
  moveLuminaPost,
  type LuminaPost,
  type LuminaPostCategory,
  type LuminaPostTreeNode,
} from '../api/posts'
import { useLuminaRelease } from '../api/release'
import { DocModal } from '../components/DocModal'
import { Markdown } from '../components/Markdown'
import { PostModal } from '../components/PostModal'
import { Shell } from '../components/Shell'
import { LUMINA_POSTS_PAGE_DEFAULT } from '../content'

const CATEGORIES: Array<LuminaPostCategory | 'All'> = [
  'All',
  'Release',
  'Guide',
  'Feature',
  'Announcement',
]

export function formatLuminaDate(iso: string | null | undefined): string {
  if (!iso) return 'Recently'
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  } catch {
    return 'Recently'
  }
}

interface PostTreeItemProps {
  node: LuminaPostTreeNode
  isAdmin: boolean
  collapsed: Record<string, boolean>
  confirmDeleteFor: string | null
  deleting: boolean
  onToggleCollapse: (slug: string) => void
  onEdit: (post: LuminaPost) => void
  onMove: (id: string, direction: 'up' | 'down') => void
  onRequestDelete: (id: string | null) => void
  onDelete: (post: LuminaPost, cascade: boolean) => void
}

function PostTreeItem({
  node,
  isAdmin,
  collapsed,
  confirmDeleteFor,
  deleting,
  onToggleCollapse,
  onEdit,
  onMove,
  onRequestDelete,
  onDelete,
}: PostTreeItemProps) {
  const { post, children } = node
  const isCollapsed = Boolean(collapsed[post.slug])

  return (
    <div className="lumina-post-tree-item">
      <div className="lumina-post-card-wrap">
        <Link to={`/lumina/posts/${post.slug}`} className="lumina-post-card">
          <div className="lumina-post-card-top">
            <div className="lumina-post-meta-bar">
              <span className={`lumina-post-cat-badge is-${post.category.toLowerCase()}`}>
                {post.category}
              </span>
              {post.version ? (
                <span className="lumina-post-ver-badge">
                  {post.version.startsWith('v') ? post.version : `v${post.version}`}
                </span>
              ) : null}
              {post.featured ? (
                <span className="lumina-post-featured-badge">Featured</span>
              ) : null}
              {post.parent_slug ? (
                <span className="lumina-post-sub-badge">↳ Sub-topic</span>
              ) : null}
              {post.status !== 'published' ? (
                <span className="lumina-post-draft-badge">{post.status}</span>
              ) : null}
            </div>
            <span className="lumina-post-date">
              {formatLuminaDate(post.published_at || post.created_at)}
            </span>
          </div>

          <h2 className="lumina-post-card-title">{post.title}</h2>
          {post.summary ? (
            <p className="lumina-post-card-summary">{post.summary}</p>
          ) : null}

          <div className="lumina-post-card-foot">
            <span className="lumina-post-author">By {post.author_name}</span>
            <span className="lumina-post-readmore">
              Read article ({post.reading_time_minutes} min) →
            </span>
          </div>
        </Link>

        <div className="lumina-post-card-tools">
          {children.length > 0 ? (
            <button
              type="button"
              className="lumina-post-collapse-btn"
              onClick={() => onToggleCollapse(post.slug)}
              aria-expanded={!isCollapsed}
              aria-label={isCollapsed ? `Expand ${post.title} sub-topics` : `Collapse ${post.title} sub-topics`}
              title={isCollapsed ? 'Show sub-topics' : 'Hide sub-topics'}
            >
              {isCollapsed ? '▸' : '▾'}
              <span>{children.length}</span>
            </button>
          ) : null}
          {isAdmin ? (
            <>
              <button
                type="button"
                className="lumina-post-move-btn"
                onClick={() => onMove(post.id, 'up')}
                aria-label={`Move ${post.title} up`}
                title="Move up among siblings"
              >
                ▲
              </button>
              <button
                type="button"
                className="lumina-post-move-btn"
                onClick={() => onMove(post.id, 'down')}
                aria-label={`Move ${post.title} down`}
                title="Move down among siblings"
              >
                ▼
              </button>
              <button
                type="button"
                className="lumina-post-card-edit-btn"
                title="Edit this post"
                onClick={() => onEdit(post)}
              >
                <PencilIcon size={12} />
                <span>Edit</span>
              </button>
              <button
                type="button"
                className="lumina-post-delete-btn"
                title="Delete this post"
                aria-label={`Delete ${post.title}`}
                onClick={() => onRequestDelete(post.id)}
              >
                <TrashIcon size={12} />
              </button>
            </>
          ) : null}
        </div>

        {confirmDeleteFor === post.id ? (
          <div className="lumina-post-delete-confirm" role="alertdialog" aria-label={`Delete ${post.title}`}>
            <span className="lumina-post-delete-confirm-title">
              Delete “{post.title}”?
            </span>
            <div className="lumina-post-delete-actions">
              <button
                type="button"
                className="btn btn-small btn-danger"
                disabled={deleting}
                onClick={() => onDelete(post, false)}
              >
                {children.length > 0 ? 'Only this post' : 'Delete post'}
              </button>
              {children.length > 0 ? (
                <button
                  type="button"
                  className="btn btn-small btn-danger"
                  disabled={deleting}
                  onClick={() => onDelete(post, true)}
                >
                  With {children.length} sub-topic{children.length === 1 ? '' : 's'}
                </button>
              ) : null}
              <button
                type="button"
                className="btn btn-small"
                disabled={deleting}
                onClick={() => onRequestDelete(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}

        {children.length > 0 && !isCollapsed ? (
          <div className="lumina-post-children">
            {children.map((child) => (
              <PostTreeItem
                key={child.post.id}
                node={child}
                isAdmin={isAdmin}
                collapsed={collapsed}
                confirmDeleteFor={confirmDeleteFor}
                deleting={deleting}
                onToggleCollapse={onToggleCollapse}
                onEdit={onEdit}
                onMove={onMove}
                onRequestDelete={onRequestDelete}
                onDelete={onDelete}
              />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}

export function PostsPage({ openCreateInitially = false }: { openCreateInitially?: boolean }) {
  const { navigate } = useRouter()
  const isAdmin = useIsAdmin()
  const release = useLuminaRelease()
  const [posts, setPosts] = useState<LuminaPost[]>([])
  const [loading, setLoading] = useState(true)
  const [activeCategory, setActiveCategory] = useState<LuminaPostCategory | 'All'>('All')
  const [searchQuery, setSearchQuery] = useState('')
  const [creatingPost, setCreatingPost] = useState(openCreateInitially)
  const [editingPost, setEditingPost] = useState<LuminaPost | null>(null)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [confirmDeleteFor, setConfirmDeleteFor] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [postsDoc, setPostsDoc] = useState<LuminaDocRecord | null>(null)
  const [headerModalOpen, setHeaderModalOpen] = useState(false)

  const postTree = useMemo(() => buildLuminaPostTree(posts), [posts])

  const headerSection = postsDoc?.section ?? LUMINA_POSTS_PAGE_DEFAULT.section
  const headerTitle = postsDoc?.title ?? LUMINA_POSTS_PAGE_DEFAULT.title
  const headerSubtitle = postsDoc?.subtitle ?? LUMINA_POSTS_PAGE_DEFAULT.subtitle
  const headerContent = postsDoc?.content ?? LUMINA_POSTS_PAGE_DEFAULT.content

  useEffect(() => {
    setCreatingPost(openCreateInitially)
  }, [openCreateInitially])

  useEffect(() => {
    let active = true
    fetchLuminaDocsMap()
      .then((map) => {
        if (active) setPostsDoc(map[LUMINA_POSTS_PAGE_DEFAULT.slug] ?? null)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    let active = true
    setLoading(true)
    listLuminaPosts({
      category: activeCategory,
      includeDrafts: isAdmin,
      search: searchQuery,
    })
      .then((rows) => {
        if (active) setPosts(rows)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [activeCategory, isAdmin, searchQuery])

  const handleToggleCollapse = (slug: string) => {
    setCollapsed((prev) => ({ ...prev, [slug]: !prev[slug] }))
  }

  const handleMove = async (id: string, direction: 'up' | 'down') => {
    await moveLuminaPost(id, direction)
    const rows = await listLuminaPosts({
      category: activeCategory,
      includeDrafts: isAdmin,
      search: searchQuery,
    })
    setPosts(rows)
  }

  const handleDelete = async (post: LuminaPost, cascade: boolean) => {
    setDeleting(true)
    setDeleteError(null)
    try {
      await deleteLuminaPost(post.id, { cascade })
      const rows = await listLuminaPosts({
        category: activeCategory,
        includeDrafts: isAdmin,
        search: searchQuery,
      })
      setPosts(rows)
      setConfirmDeleteFor(null)
      if (editingPost?.id === post.id) setEditingPost(null)
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Could not delete the post.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Shell
      release={release}
      onPostCreated={(created) => {
        setPosts((prev) => [created, ...prev])
      }}
    >
      <div className="lumina-doc-article">
        <header className="lumina-doc-header">
          <div className="lumina-doc-header-top">
            <span className="lumina-doc-kicker">
              {postsDoc?.summary?.trim() || headerSection}
            </span>
            {isAdmin ? (
              <button
                type="button"
                className="lumina-edit-page-header-btn"
                onClick={() => setHeaderModalOpen(true)}
                title="Edit this page's title, subtitle and content"
              >
                <PencilIcon size={12} />
                <span>Edit page header</span>
              </button>
            ) : null}
          </div>
          <h1 className="lumina-doc-title">{headerTitle}</h1>
          {headerSubtitle ? (
            <p className="lumina-doc-subtitle">{headerSubtitle}</p>
          ) : null}
        </header>

        {headerContent.trim() ? (
          <div className="lumina-posts-page-intro">
            <Markdown content={headerContent} />
          </div>
        ) : null}

        {deleteError ? (
          <div className="post-studio-alert" role="alert">
            <span>{deleteError}</span>
          </div>
        ) : null}

        <div className="lumina-posts-controls">
          <div className="lumina-posts-categories" role="tablist">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                role="tab"
                aria-selected={activeCategory === cat}
                className={`lumina-cat-pill ${activeCategory === cat ? 'is-active' : ''}`}
                onClick={() => setActiveCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="lumina-posts-search-wrap">
            <SearchIcon size={13} />
            <input
              type="search"
              className="lumina-posts-filter-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search Lumina posts…"
              aria-label="Search Lumina posts"
            />
          </div>
        </div>

        {loading ? (
          <div className="lumina-empty-card">Loading Lumina posts…</div>
        ) : posts.length === 0 ? (
          <div className="lumina-empty-card">
            <h3>No posts published yet</h3>
            <p>
              {isAdmin
                ? 'Click the composer bar above or the floating + button at the bottom right to publish your first release update or guide.'
                : 'Release updates, guides, and announcements will appear here once published.'}
            </p>
          </div>
        ) : (
          <div className="lumina-posts-list">
            {postTree.map((node) => (
              <PostTreeItem
                key={node.post.id}
                node={node}
                isAdmin={isAdmin}
                collapsed={collapsed}
                confirmDeleteFor={confirmDeleteFor}
                deleting={deleting}
                onToggleCollapse={handleToggleCollapse}
                onEdit={setEditingPost}
                onMove={(id, direction) => void handleMove(id, direction)}
                onRequestDelete={setConfirmDeleteFor}
                onDelete={(post, cascade) => void handleDelete(post, cascade)}
              />
            ))}
          </div>
        )}
      </div>

      {creatingPost ? (
        <PostModal
          mode="create"
          defaultVersion={release.version}
          onClose={() => {
            setCreatingPost(false)
            if (openCreateInitially) navigate('/lumina/posts')
          }}
          onSaved={(created) => {
            setPosts((prev) => [created, ...prev])
            navigate(`/lumina/posts/${created.slug}`)
          }}
        />
      ) : null}

      {editingPost ? (
        <PostModal
          mode="update"
          post={editingPost}
          defaultVersion={release.version}
          onClose={() => setEditingPost(null)}
          onSaved={(updated) => {
            setPosts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
          }}
          onDelete={async (toDelete, options) => {
            await handleDelete(toDelete, options?.cascade ?? false)
          }}
        />
      ) : null}

      {headerModalOpen ? (
        <DocModal
          doc={{
            slug: LUMINA_POSTS_PAGE_DEFAULT.slug,
            section: headerSection,
            title: headerTitle,
            subtitle: headerSubtitle,
            summary: postsDoc?.summary ?? null,
            content: headerContent,
            sort_order: LUMINA_POSTS_PAGE_DEFAULT.sortOrder,
            published: true,
          }}
          onClose={() => setHeaderModalOpen(false)}
          onSaved={(saved) => {
            setPostsDoc(saved)
            setHeaderModalOpen(false)
          }}
        />
      ) : null}
    </Shell>
  )
}
