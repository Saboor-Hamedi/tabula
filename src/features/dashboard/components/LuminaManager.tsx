import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from '../../../core/router'
import { ROUTES } from '../../../core/router/paths'
import { formatCount } from '../../../core/utils/format'
import { useIsAdmin } from '../../auth/useProfile'
import { IconButton } from '../../common/IconButton'
import {
  CheckIcon,
  ExternalIcon,
  FileIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  SparklesIcon,
  TrashIcon,
} from '../../common/Icons'
import { Pagination } from '../../common/Pagination'
import {
  deleteLuminaDoc,
  deleteLuminaPost,
  listAllLuminaDocs,
  listAllLuminaPosts,
  LUMINA_DOC_PAGES,
  LuminaDocModal,
  LuminaPostModal,
  saveLuminaDoc,
  setLuminaPostStatus,
  useLuminaRelease,
  type LuminaDocRecord,
  type LuminaPost,
  type LuminaPostStatus,
} from '../../lumina'

type SubView = 'posts' | 'docs'
type StatusFilter = 'all' | LuminaPostStatus

function formatShortDate(value: string | null | undefined): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function LuminaManager() {
  const isAdmin = useIsAdmin()
  const release = useLuminaRelease()
  const [subView, setSubView] = useState<SubView>('posts')

  // Posts CRUD state
  const [posts, setPosts] = useState<LuminaPost[]>([])
  const [postsLoading, setPostsLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [postQuery, setPostQuery] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(8)
  const [editingPost, setEditingPost] = useState<LuminaPost | null>(null)
  const [creatingPost, setCreatingPost] = useState(false)
  const [confirmDeletePostId, setConfirmDeletePostId] = useState<string | null>(null)

  // Docs CRUD state
  const [dbDocs, setDbDocs] = useState<LuminaDocRecord[]>([])
  const [docsLoading, setDocsLoading] = useState(true)
  const [docQuery, setDocQuery] = useState('')
  const [editingDoc, setEditingDoc] = useState<LuminaDocRecord | null>(null)
  const [creatingDoc, setCreatingDoc] = useState(false)
  const [syncingDefaults, setSyncingDefaults] = useState(false)

  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadPosts = useCallback(async () => {
    try {
      const rows = await listAllLuminaPosts()
      setPosts(rows)
      setError(null)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Lumina posts could not be loaded. Make sure lumina.sql is applied in Supabase.',
      )
    } finally {
      setPostsLoading(false)
    }
  }, [])

  const loadDocs = useCallback(async () => {
    try {
      const rows = await listAllLuminaDocs()
      setDbDocs(rows)
    } catch {
      // Fall back to default docs view if lumina_docs is not created yet
    } finally {
      setDocsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!isAdmin) {
      setPostsLoading(false)
      setDocsLoading(false)
      return
    }
    void loadPosts()
    void loadDocs()
  }, [isAdmin, loadPosts, loadDocs])

  const counts = useMemo(() => {
    let published = 0
    let draft = 0
    let archived = 0
    for (const post of posts) {
      if (post.status === 'published') published += 1
      else if (post.status === 'draft') draft += 1
      else archived += 1
    }
    return { all: posts.length, published, draft, archived }
  }, [posts])

  const filteredPosts = useMemo(() => {
    const term = postQuery.trim().toLowerCase()
    return posts.filter((post) => {
      if (statusFilter !== 'all' && post.status !== statusFilter) return false
      if (!term) return true
      return [post.title, post.summary, post.category, post.version, ...post.tags]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(term))
    })
  }, [posts, statusFilter, postQuery])

  useEffect(() => {
    setPage(1)
  }, [statusFilter, postQuery, pageSize])

  const totalPages = Math.max(1, Math.ceil(filteredPosts.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const pagedPosts = useMemo(() => {
    const start = (safePage - 1) * pageSize
    return filteredPosts.slice(start, start + pageSize)
  }, [filteredPosts, safePage, pageSize])

  // Merge DB docs with built-in doc pages so every page is editable via form
  const mergedDocs = useMemo(() => {
    const bySlug = new Map<string, LuminaDocRecord & { path: string; isSynced: boolean }>()
    for (const def of LUMINA_DOC_PAGES) {
      bySlug.set(def.slug, {
        slug: def.slug,
        section: def.section,
        title: def.title,
        subtitle: def.subtitle,
        summary: def.summary,
        content: def.content,
        sort_order: def.sortOrder,
        published: true,
        path: def.path,
        isSynced: false,
      })
    }
    for (const row of dbDocs) {
      const existing = bySlug.get(row.slug)
      bySlug.set(row.slug, {
        ...row,
        path: existing?.path ?? `/lumina/${row.slug}`,
        isSynced: true,
      })
    }
    const list = Array.from(bySlug.values()).sort((a, b) => a.sort_order - b.sort_order)
    const term = docQuery.trim().toLowerCase()
    if (!term) return list
    return list.filter(
      (d) =>
        d.title.toLowerCase().includes(term) ||
        d.slug.toLowerCase().includes(term) ||
        d.section.toLowerCase().includes(term),
    )
  }, [dbDocs, docQuery])

  const handleTogglePostPublish = async (post: LuminaPost, publish: boolean) => {
    setBusyId(post.id)
    try {
      await setLuminaPostStatus(post.id, publish ? 'published' : 'archived')
      await loadPosts()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update post status.')
    } finally {
      setBusyId(null)
    }
  }

  const handleRemovePost = async (post: LuminaPost) => {
    setBusyId(post.id)
    try {
      await deleteLuminaPost(post.id)
      setConfirmDeletePostId(null)
      await loadPosts()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete Lumina post.')
    } finally {
      setBusyId(null)
    }
  }

  const handleSyncDefaultDocs = async () => {
    setSyncingDefaults(true)
    setError(null)
    try {
      for (const page of LUMINA_DOC_PAGES) {
        const alreadyInDb = dbDocs.some((d) => d.slug === page.slug)
        if (!alreadyInDb) {
          await saveLuminaDoc({
            slug: page.slug,
            section: page.section,
            title: page.title,
            subtitle: page.subtitle,
            summary: page.summary,
            content: page.content,
            sort_order: page.sortOrder,
            published: true,
          })
        }
      }
      await loadDocs()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sync default docs to Supabase.')
    } finally {
      setSyncingDefaults(false)
    }
  }

  const handleDeleteDocOverride = async (slug: string) => {
    setBusyId(slug)
    try {
      await deleteLuminaDoc(slug)
      await loadDocs()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove doc override.')
    } finally {
      setBusyId(null)
    }
  }

  if (!isAdmin) return null

  return (
    <div className="dash-admin-stack">
      <section className="dash-panel">
        <header className="dash-panel-head">
          <div className="dash-panel-titles">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h2 className="dash-section-title">Lumina Content &amp; Releases</h2>
              {release.version ? (
                <span className="dash-count-pill" title={`Fetched via ${release.source}`}>
                  GitHub {release.version}
                </span>
              ) : null}
            </div>
            <span className="dash-panel-note">
              Full CRUD for Lumina release posts (`public.lumina_posts`) and documentation pages (`public.lumina_docs`).
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div className="dash-filter-pills" role="tablist" aria-label="Lumina manager view">
              <button
                type="button"
                role="tab"
                aria-selected={subView === 'posts'}
                className={`dash-filter-pill ${subView === 'posts' ? 'is-active' : ''}`}
                onClick={() => setSubView('posts')}
              >
                Posts ({posts.length})
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={subView === 'docs'}
                className={`dash-filter-pill ${subView === 'docs' ? 'is-active' : ''}`}
                onClick={() => setSubView('docs')}
              >
                Documentation ({mergedDocs.length})
              </button>
            </div>

            {subView === 'posts' ? (
              <button
                type="button"
                className="btn btn-small btn-primary"
                onClick={() => setCreatingPost(true)}
              >
                <PlusIcon size={12} />
                <span>Create Lumina Post</span>
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className="btn btn-small"
                  disabled={syncingDefaults}
                  onClick={() => void handleSyncDefaultDocs()}
                  title="Seed all default documentation pages into public.lumina_docs"
                >
                  <SparklesIcon size={12} />
                  <span>{syncingDefaults ? 'Syncing…' : 'Sync Default Docs'}</span>
                </button>
                <button
                  type="button"
                  className="btn btn-small btn-primary"
                  onClick={() => setCreatingDoc(true)}
                >
                  <PlusIcon size={12} />
                  <span>New Doc Page</span>
                </button>
              </>
            )}

            <Link
              className="dash-panel-link"
              to={subView === 'posts' ? ROUTES.luminaPosts : ROUTES.lumina}
            >
              View /lumina
              <ExternalIcon size={12} />
            </Link>
          </div>
        </header>

        {error ? (
          <p className="publish-error" style={{ padding: '12px 18px' }}>
            {error}
          </p>
        ) : null}

        {subView === 'posts' ? (
          <>
            <div className="dash-table-tools dash-posts-tools">
              <div className="dash-filter-tabs" role="tablist" aria-label="Filter Lumina posts">
                {(
                  [
                    { id: 'all', label: 'All', count: counts.all },
                    { id: 'published', label: 'Live', count: counts.published },
                    { id: 'draft', label: 'Drafts', count: counts.draft },
                    { id: 'archived', label: 'Archived', count: counts.archived },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    role="tab"
                    aria-selected={statusFilter === item.id}
                    className={`dash-filter-tab ${statusFilter === item.id ? 'is-active' : ''}`}
                    onClick={() => setStatusFilter(item.id)}
                  >
                    <span>{item.label}</span>
                    <span className="dash-filter-count">{formatCount(item.count)}</span>
                  </button>
                ))}
              </div>

              <div className="dash-table-search">
                <SearchIcon size={13} />
                <input
                  type="search"
                  value={postQuery}
                  onChange={(event) => setPostQuery(event.target.value)}
                  placeholder="Search Lumina posts…"
                  aria-label="Search Lumina posts"
                />
              </div>
            </div>

            {postsLoading ? (
              <p className="dash-table-empty">Loading Lumina posts…</p>
            ) : filteredPosts.length === 0 ? (
              <div className="dash-table-empty">
                <p>
                  {posts.length === 0
                    ? 'No Lumina posts published yet. Click “Create Lumina Post” to write your first release update, guide, or announcement.'
                    : 'No Lumina posts match your filter or search.'}
                </p>
              </div>
            ) : (
              <>
                <ul className="dash-insight-list">
                  {pagedPosts.map((post) => (
                    <li className="dash-insight" key={post.id}>
                      <div className="dash-insight-main">
                        <div className="dash-insight-top">
                          <span className={`dash-status is-${post.status}`}>
                            {post.status === 'published' ? 'Live' : post.status}
                          </span>
                          <span className="dash-insight-tag">{post.category}</span>
                          {post.version ? (
                            <span className="dash-insight-tag">
                              {post.version.startsWith('v') ? post.version : `v${post.version}`}
                            </span>
                          ) : null}
                          <Link
                            className="dash-insight-title"
                            to={`/lumina/posts/${post.slug}`}
                          >
                            {post.title}
                          </Link>
                        </div>

                        <div className="dash-insight-meta">
                          <span>{formatCount(post.view_count)} views</span>
                          <span>·</span>
                          <span>{post.reading_time_minutes} min read</span>
                          <span>·</span>
                          <span>{formatShortDate(post.published_at ?? post.created_at)}</span>
                        </div>
                      </div>

                      <div className="dash-insight-actions">
                        <button
                          type="button"
                          className="btn btn-small"
                          disabled={busyId === post.id}
                          onClick={() => setEditingPost(post)}
                        >
                          <PencilIcon size={12} />
                          <span>Update</span>
                        </button>
                        {post.status === 'published' ? (
                          <button
                            type="button"
                            className="btn btn-small"
                            disabled={busyId === post.id}
                            onClick={() => void handleTogglePostPublish(post, false)}
                          >
                            Unpublish
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-small btn-primary"
                            disabled={busyId === post.id}
                            onClick={() => void handleTogglePostPublish(post, true)}
                          >
                            <CheckIcon size={12} />
                            <span>Publish</span>
                          </button>
                        )}
                        <Link className="btn btn-small" to={`/lumina/posts/${post.slug}`}>
                          View
                        </Link>
                        {confirmDeletePostId === post.id ? (
                          <>
                            <button
                              type="button"
                              className="btn btn-small btn-danger"
                              disabled={busyId === post.id}
                              onClick={() => void handleRemovePost(post)}
                            >
                              {busyId === post.id ? 'Deleting…' : 'Confirm'}
                            </button>
                            <button
                              type="button"
                              className="btn btn-small"
                              disabled={busyId === post.id}
                              onClick={() => setConfirmDeletePostId(null)}
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <IconButton
                            label="Delete Lumina post"
                            size="sm"
                            onClick={() => setConfirmDeletePostId(post.id)}
                          >
                            <TrashIcon size={14} />
                          </IconButton>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>

                <Pagination
                  page={safePage}
                  pageSize={pageSize}
                  totalItems={filteredPosts.length}
                  onPageChange={setPage}
                  onPageSizeChange={setPageSize}
                  pageSizeOptions={[8, 15, 30]}
                  itemLabel="Lumina posts"
                />
              </>
            )}
          </>
        ) : (
          /* DOCUMENTATION CRUD VIEW (`public.lumina_docs`) */
          <>
            <div className="dash-table-tools dash-posts-tools">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <FileIcon size={13} />
                <span className="dash-panel-note">
                  Edit any `/lumina` documentation page or add new pages directly to `public.lumina_docs`.
                </span>
              </div>

              <div className="dash-table-search">
                <SearchIcon size={13} />
                <input
                  type="search"
                  value={docQuery}
                  onChange={(event) => setDocQuery(event.target.value)}
                  placeholder="Search doc pages…"
                  aria-label="Search Lumina documentation pages"
                />
              </div>
            </div>

            {docsLoading ? (
              <p className="dash-table-empty">Loading documentation pages…</p>
            ) : (
              <ul className="dash-insight-list">
                {mergedDocs.map((doc) => (
                  <li className="dash-insight" key={doc.slug}>
                    <div className="dash-insight-main">
                      <div className="dash-insight-top">
                        <span className={`dash-status ${doc.isSynced ? 'is-published' : 'is-draft'}`}>
                          {doc.isSynced ? 'DB Synced' : 'Default'}
                        </span>
                        <span className="dash-insight-tag">{doc.section}</span>
                        <Link className="dash-insight-title" to={doc.path}>
                          {doc.title}
                        </Link>
                      </div>

                      <div className="dash-insight-meta">
                        <span>slug: {doc.slug}</span>
                        <span>·</span>
                        <span>path: {doc.path}</span>
                        {doc.updated_at ? (
                          <>
                            <span>·</span>
                            <span>Updated {formatShortDate(doc.updated_at)}</span>
                          </>
                        ) : null}
                      </div>
                    </div>

                    <div className="dash-insight-actions">
                      <button
                        type="button"
                        className="btn btn-small"
                        onClick={() => setEditingDoc(doc)}
                      >
                        <PencilIcon size={12} />
                        <span>Edit Doc</span>
                      </button>
                      <Link className="btn btn-small" to={doc.path}>
                        View
                      </Link>
                      {doc.isSynced ? (
                        <IconButton
                          label="Reset DB override"
                          size="sm"
                          disabled={busyId === doc.slug}
                          onClick={() => void handleDeleteDocOverride(doc.slug)}
                        >
                          <TrashIcon size={14} />
                        </IconButton>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>

      {creatingPost ? (
        <LuminaPostModal
          mode="create"
          defaultVersion={release.version}
          onClose={() => setCreatingPost(false)}
          onSaved={(created) => {
            setPosts((prev) => [created, ...prev])
          }}
        />
      ) : null}

      {editingPost ? (
        <LuminaPostModal
          mode="update"
          post={editingPost}
          defaultVersion={release.version}
          onClose={() => setEditingPost(null)}
          onSaved={(updated) => {
            setPosts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
          }}
          onDelete={async (toDelete) => {
            await handleRemovePost(toDelete)
            setEditingPost(null)
          }}
        />
      ) : null}

      {creatingDoc ? (
        <LuminaDocModal
          doc={null}
          onClose={() => setCreatingDoc(false)}
          onSaved={() => void loadDocs()}
        />
      ) : null}

      {editingDoc ? (
        <LuminaDocModal
          doc={editingDoc}
          onClose={() => setEditingDoc(null)}
          onSaved={() => void loadDocs()}
        />
      ) : null}
    </div>
  )
}
