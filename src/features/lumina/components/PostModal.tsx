import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertIcon,
  CheckIcon,
  EyeIcon,
  PencilIcon,
  TrashIcon,
} from '../../common/Icons'
import {
  deriveMarkdownSummary,
  estimateMarkdownReadingTime,
  hasLuminaPostHierarchy,
  isLuminaPostDescendant,
  listAllLuminaPosts,
  listLuminaPostChildren,
  saveLuminaPost,
  slugifyLuminaTitle,
  type LuminaPost,
  type LuminaPostCategory,
  type LuminaPostStatus,
} from '../api/posts'
import { Markdown } from './Markdown'

export interface PostModalProps {
  post?: LuminaPost | null
  mode?: 'update' | 'create'
  initialCategory?: LuminaPostCategory
  defaultVersion?: string | null
  onClose: () => void
  onSaved?: (saved: LuminaPost) => void
  onDelete?: (
    post: LuminaPost,
    options?: { cascade?: boolean },
  ) => Promise<void> | void
}

type StudioTab = 'edit' | 'review'
type ReviewViewport = 'desktop' | 'tablet' | 'mobile'

const CATEGORIES: LuminaPostCategory[] = [
  'Release',
  'Guide',
  'Feature',
  'Announcement',
]

const DRAFT_STORAGE_KEY = 'lumina:post_draft:v1'

interface SavedPostDraft {
  title: string
  slug: string
  category: LuminaPostCategory
  version: string
  summary: string
  tagsText: string
  content: string
  parentSlug?: string
  sortOrder?: number
}

interface ParentOption {
  id: string
  slug: string
  title: string
  parent_slug: string | null
}

function loadSavedDraft(): SavedPostDraft | null {
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(DRAFT_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as SavedPostDraft
    if (parsed && (parsed.title || parsed.content)) return parsed
  } catch {
    // ignore storage errors
  }
  return null
}

function clearSavedDraft(): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.removeItem(DRAFT_STORAGE_KEY)
  } catch {
    // ignore
  }
}

export function PostModal({
  post = null,
  mode = post ? 'update' : 'create',
  initialCategory,
  defaultVersion = null,
  onClose,
  onSaved,
  onDelete,
}: PostModalProps) {
  const isUpdate = mode === 'update' && Boolean(post)
  const savedDraft = useMemo(() => (!isUpdate ? loadSavedDraft() : null), [isUpdate])

  const [title, setTitle] = useState(() => post?.title ?? savedDraft?.title ?? '')
  const [slug, setSlug] = useState(() => post?.slug ?? savedDraft?.slug ?? '')
  const [slugTouched, setSlugTouched] = useState(() => Boolean(post?.slug || savedDraft?.slug))
  const [category, setCategory] = useState<LuminaPostCategory>(
    () => post?.category ?? initialCategory ?? savedDraft?.category ?? 'Release',
  )
  const [version, setVersion] = useState(
    () => post?.version ?? savedDraft?.version ?? defaultVersion ?? '',
  )
  const [summary, setSummary] = useState(() => post?.summary ?? savedDraft?.summary ?? '')
  const [tagsText, setTagsText] = useState(
    () => (post?.tags ? post.tags.join(', ') : savedDraft?.tagsText ?? ''),
  )
  const [status, setStatus] = useState<LuminaPostStatus>(() => post?.status ?? 'published')
  const [featured, setFeatured] = useState<boolean>(() => Boolean(post?.featured))
  const [parentSlug, setParentSlug] = useState(
    () => post?.parent_slug ?? savedDraft?.parentSlug ?? '',
  )
  const [sortOrder, setSortOrder] = useState(
    () => post?.sort_order ?? savedDraft?.sortOrder ?? 100,
  )
  const [parentOptions, setParentOptions] = useState<ParentOption[]>([])
  const [content, setContent] = useState(() => post?.content ?? savedDraft?.content ?? '')
  const [draftRestored, setDraftRestored] = useState(() => Boolean(savedDraft))

  const [activeTab, setActiveTab] = useState<StudioTab>('edit')
  const [viewport, setViewport] = useState<ReviewViewport>('desktop')
  const [touched, setTouched] = useState<{ title?: boolean; content?: boolean }>({})
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [childCount, setChildCount] = useState(0)
  const [hierarchyReady, setHierarchyReady] = useState(false)
  const [newParentTitle, setNewParentTitle] = useState('')
  const [creatingParent, setCreatingParent] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!slugTouched) {
      setSlug(slugifyLuminaTitle(title))
    }
  }, [title, slugTouched])

  useEffect(() => {
    let active = true
    hasLuminaPostHierarchy().then((ready) => {
      if (active) setHierarchyReady(ready)
    })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    let active = true
    listAllLuminaPosts()
      .then((all) => {
        if (!active) return
        const bySlug = new Map(all.map((item) => [item.slug, item]))
        const options = all
          .filter((candidate) => {
            if (!isUpdate || !post) return true
            if (candidate.id === post.id) return false
            return !isLuminaPostDescendant(candidate, post.slug, bySlug)
          })
          .map((item) => ({
            id: item.id,
            slug: item.slug,
            title: item.title,
            parent_slug: item.parent_slug,
          }))
        setParentOptions(options)
      })
      .catch(() => {
        if (active) setParentOptions([])
      })
    return () => {
      active = false
    }
  }, [isUpdate, post])

  const editingSlug = isUpdate ? (post?.slug ?? null) : null

  useEffect(() => {
    if (!editingSlug) return
    let active = true
    listLuminaPostChildren(editingSlug).then((children) => {
      if (active) setChildCount(children.length)
    })
    return () => {
      active = false
    }
  }, [editingSlug])

  const parentLabel = parentOptions.find((item) => item.slug === parentSlug)?.title ?? ''

  // Auto-save draft to localStorage when creating a new post
  useEffect(() => {
    if (isUpdate || typeof localStorage === 'undefined') return
    if (!title.trim() && !content.trim()) return
    try {
      const payload: SavedPostDraft = {
        title,
        slug,
        category,
        version,
        summary,
        tagsText,
        content,
        parentSlug,
        sortOrder,
      }
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(payload))
    } catch {
      // ignore quota errors
    }
  }, [isUpdate, title, slug, category, version, summary, tagsText, content, parentSlug, sortOrder])

  const normalizedTags = useMemo(
    () =>
      tagsText
        .split(',')
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean)
        .slice(0, 8),
    [tagsText],
  )

  const wordCount = useMemo(
    () => content.trim().split(/\s+/).filter(Boolean).length,
    [content],
  )
  const readingTime = useMemo(() => estimateMarkdownReadingTime(content), [content])

  const validation = useMemo(() => {
    const cleanTitle = title.trim()
    const cleanContent = content.trim()
    const titleError =
      cleanTitle.length === 0
        ? 'Post title is required.'
        : cleanTitle.length < 3
          ? 'Post title must be at least 3 characters.'
          : cleanTitle.length > 240
            ? 'Post title cannot exceed 240 characters.'
            : null

    const contentError =
      cleanContent.length === 0
        ? 'Post content is required.'
        : cleanContent.length < 10
          ? 'Post content must be at least 10 characters.'
          : null

    return {
      titleError,
      contentError,
      isValid: !titleError && !contentError,
    }
  }, [title, content])

  const applySelectionFormat = (before: string, after = '', placeholder = 'text') => {
    const el = textareaRef.current
    if (!el) {
      setContent((prev) => `${prev}${before}${placeholder}${after}`)
      return
    }
    const start = el.selectionStart ?? content.length
    const end = el.selectionEnd ?? content.length
    const selected = content.slice(start, end) || placeholder
    const next = `${content.slice(0, start)}${before}${selected}${after}${content.slice(end)}`
    setContent(next)
    setTouched((prev) => ({ ...prev, content: true }))
    requestAnimationFrame(() => {
      el.focus()
      const cursorStart = start + before.length
      el.setSelectionRange(cursorStart, cursorStart + selected.length)
    })
  }

  const insertBlock = (snippet: string) => {
    const el = textareaRef.current
    if (!el) {
      setContent((prev) => `${prev.trimEnd()}\n\n${snippet.trim()}\n`)
      return
    }
    const pos = el.selectionEnd ?? content.length
    const prefix = content.slice(0, pos).trimEnd()
    const suffix = content.slice(pos).trimStart()
    const next = `${prefix ? `${prefix}\n\n` : ''}${snippet.trim()}\n${suffix ? `\n${suffix}` : ''}`
    setContent(next)
    setTouched((prev) => ({ ...prev, content: true }))
    requestAnimationFrame(() => el.focus())
  }

  const handleClearDraft = () => {
    clearSavedDraft()
    setTitle('')
    setSlug('')
    setSlugTouched(false)
    setSummary('')
    setTagsText('')
    setContent('')
    setParentSlug('')
    setSortOrder(100)
    setDraftRestored(false)
  }

  const handleCreateParent = async () => {
    const cleanTitle = newParentTitle.trim()
    if (cleanTitle.length < 3 || creatingParent || !hierarchyReady) return
    setCreatingParent(true)
    setError(null)
    try {
      const created = await saveLuminaPost({
        title: cleanTitle,
        category,
        status: 'published',
        summary: '',
        content: `## ${cleanTitle}\n\nWrite the introduction for this section here.`,
      })
      setParentOptions((prev) => [
        ...prev.filter((option) => option.id !== created.id),
        {
          id: created.id,
          slug: created.slug,
          title: created.title,
          parent_slug: created.parent_slug,
        },
      ])
      setParentSlug(created.slug)
      setNewParentTitle('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the parent post.')
    } finally {
      setCreatingParent(false)
    }
  }

  const handleSave = async (event?: React.FormEvent) => {
    event?.preventDefault()
    setTouched({ title: true, content: true })

    if (!validation.isValid) {
      setError(
        validation.titleError ??
          validation.contentError ??
          'Please complete all required fields.',
      )
      return
    }

    setSaving(true)
    setError(null)
    try {
      const saved = await saveLuminaPost({
        id: isUpdate && post ? post.id : undefined,
        title: title.trim(),
        slug: slug.trim() || slugifyLuminaTitle(title),
        category,
        status,
        published: status === 'published',
        featured,
        version: version.trim() || null,
        summary: summary.trim() || deriveMarkdownSummary(content),
        content,
        tags: normalizedTags,
        parentSlug: parentSlug.trim() || null,
        sortOrder,
      })
      if (!isUpdate) {
        clearSavedDraft()
      }
      onSaved?.(saved)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save Lumina post.')
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving && !deleting) {
        onClose()
        return
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        if (!saving && !deleting) {
          void handleSave()
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  const handleTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
      e.preventDefault()
      applySelectionFormat('**', '**', 'bold text')
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'i') {
      e.preventDefault()
      applySelectionFormat('*', '*', 'italic text')
    } else if (e.key === 'Tab') {
      e.preventDefault()
      applySelectionFormat('  ', '', '')
    }
  }

  const handleDeleteClick = async (cascade: boolean) => {
    if (!post || !onDelete) return
    setDeleting(true)
    setError(null)
    try {
      await onDelete(post, { cascade })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete Lumina post.')
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  return (
    <div
      className="post-studio-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={isUpdate ? 'Update Post' : 'Write a Post'}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving && !deleting) {
          onClose()
        }
      }}
    >
      <div className="post-studio-modal lumina-studio-modal" onClick={(e) => e.stopPropagation()}>
        <header className="post-studio-head">
          <div className="post-studio-head-titles" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h2 className="post-studio-title">
              {isUpdate ? 'Update Post' : 'Write a Post'}
            </h2>
            {!isUpdate && (draftRestored || title.trim() || content.trim()) ? (
              <span className="lumina-draft-pill">
                <span>Draft auto-saved</span>
                <button
                  type="button"
                  className="lumina-draft-clear-btn"
                  onClick={handleClearDraft}
                  title="Clear saved draft"
                >
                  Reset
                </button>
              </span>
            ) : null}
          </div>

          <div className="post-studio-head-controls">
            <div className="post-studio-mode-switch" role="tablist" aria-label="Editor mode">
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'edit'}
                className={`post-studio-mode-btn ${activeTab === 'edit' ? 'is-active' : ''}`}
                onClick={() => setActiveTab('edit')}
              >
                <PencilIcon size={12} />
                <span>Write</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'review'}
                className={`post-studio-mode-btn ${activeTab === 'review' ? 'is-active' : ''}`}
                onClick={() => {
                  setTouched({ title: true, content: true })
                  setActiveTab('review')
                }}
              >
                <EyeIcon size={12} />
                <span>Preview</span>
              </button>
            </div>
          </div>
        </header>

        {!isUpdate ? (
          <p className="lumina-post-modal-hint">
            This publishes an article to the <strong>/lumina/posts</strong> feed. For a sidebar
            documentation page, use <strong>New Documentation Page</strong> instead.
          </p>
        ) : null}

        {error ? (
          <div className="post-studio-alert" role="alert">
            <AlertIcon size={14} />
            <span>{error}</span>
          </div>
        ) : null}

        {activeTab !== 'review' ? (
          <form className="post-studio-body" onSubmit={(e) => void handleSave(e)} noValidate>
            {/* Title */}
            <div className="post-studio-grid-1">
              <div className="post-studio-field">
                <div className="post-studio-label-row">
                  <label className="post-studio-label" htmlFor="lumina-studio-title">
                    {parentSlug ? 'Sub-title' : 'Post Title'} <span className="post-studio-req">*</span>
                  </label>
                  <span className="post-studio-counter">{title.trim().length} / 240</span>
                </div>
                <input
                  id="lumina-studio-title"
                  type="text"
                  className={`post-studio-input ${touched.title && validation.titleError ? 'is-invalid' : ''}`}
                  value={title}
                  maxLength={240}
                  onBlur={() => setTouched((prev) => ({ ...prev, title: true }))}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={
                    parentSlug
                      ? `e.g. ${parentLabel || 'Parent topic'} — Getting Started`
                      : 'e.g. Lumina Release Notes: 3D Graph & ConPTY Terminal'
                  }
                  required
                />
                {touched.title && validation.titleError ? (
                  <span className="post-studio-field-error">{validation.titleError}</span>
                ) : null}
              </div>
            </div>

            {/* Everything optional lives behind one expander */}
            <div className="lumina-advanced-wrap">
              <button
                type="button"
                className="lumina-advanced-toggle"
                onClick={() => setShowAdvanced((v) => !v)}
                aria-expanded={showAdvanced}
              >
                {showAdvanced
                  ? 'Hide options'
                  : 'More options — category, parent, slug, version, tags, order, summary'}
              </button>
              {showAdvanced ? (
                <div className="lumina-advanced-body">
            {/* Category & Visibility */}
            <div className="post-studio-grid-2">
              <div className="post-studio-field">
                <label className="post-studio-label" htmlFor="lumina-studio-category">
                  Category
                </label>
                <select
                  id="lumina-studio-category"
                  className="post-studio-select"
                  value={category}
                  onChange={(e) => setCategory(e.target.value as LuminaPostCategory)}
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div className="post-studio-field">
                <div className="post-studio-label-row">
                  <label className="post-studio-label" htmlFor="lumina-studio-status">
                    Visibility
                  </label>
                  <label className="lumina-featured-check" htmlFor="lumina-studio-featured">
                    <input
                      id="lumina-studio-featured"
                      type="checkbox"
                      checked={featured}
                      onChange={(e) => setFeatured(e.target.checked)}
                    />
                    <span>Featured pin</span>
                  </label>
                </div>
                <select
                  id="lumina-studio-status"
                  className="post-studio-select"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as LuminaPostStatus)}
                >
                  <option value="published">Published (Live)</option>
                  <option value="draft">Draft (Admin only)</option>
                  <option value="archived">Archived (Hidden)</option>
                </select>
              </div>
            </div>

            {/* Parent / sub-topic */}
            <div className="post-studio-field">
              <div className="post-studio-label-row">
                <label className="post-studio-label" htmlFor="lumina-studio-parent">
                  Parent Post
                </label>
                {parentSlug ? (
                  <span className="post-studio-counter">
                    under {parentLabel || parentSlug}
                  </span>
                ) : null}
              </div>
              <select
                id="lumina-studio-parent"
                className="post-studio-select"
                value={parentSlug}
                disabled={!hierarchyReady}
                onChange={(e) => setParentSlug(e.target.value)}
                title="Select a post to nest this one under it"
              >
                <option value="">None — top-level post</option>
                {parentOptions.map((option) => (
                  <option key={option.id} value={option.slug}>
                    {option.parent_slug ? '↳ ' : ''}
                    {option.title}
                  </option>
                ))}
              </select>
              {hierarchyReady ? (
                <div className="lumina-new-parent-row">
                  <input
                    type="text"
                    className="post-studio-input"
                    value={newParentTitle}
                    onChange={(e) => setNewParentTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        void handleCreateParent()
                      }
                    }}
                    placeholder="No parent yet? Type a title, e.g. Introduction"
                    aria-label="New parent post title"
                  />
                  <button
                    type="button"
                    className="btn btn-small"
                    disabled={!newParentTitle.trim() || creatingParent}
                    onClick={() => void handleCreateParent()}
                  >
                    {creatingParent ? 'Creating…' : 'Create parent'}
                  </button>
                </div>
              ) : (
                <span className="lumina-hierarchy-warning">
                  Run <code>lumina-nested-posts.sql</code> in Supabase once to enable sub-topics.
                </span>
              )}
            </div>

                  <div className="post-studio-grid-2">
                    <div className="post-studio-field">
                      <label className="post-studio-label" htmlFor="lumina-studio-slug">
                        URL Slug
                      </label>
                      <input
                        id="lumina-studio-slug"
                        type="text"
                        className="post-studio-input"
                        value={slug}
                        onChange={(e) => {
                          setSlugTouched(true)
                          setSlug(slugifyLuminaTitle(e.target.value))
                        }}
                        placeholder="auto-generated-from-title"
                      />
                    </div>
                    <div className="post-studio-field">
                      <label className="post-studio-label" htmlFor="lumina-studio-version">
                        Release Version
                      </label>
                      <input
                        id="lumina-studio-version"
                        type="text"
                        className="post-studio-input"
                        value={version}
                        onChange={(e) => setVersion(e.target.value)}
                        placeholder={defaultVersion ? `Version (${defaultVersion})` : 'Version (optional)'}
                      />
                    </div>
                  </div>
                  <div className="post-studio-grid-2">
                    <div className="post-studio-field">
                      <label className="post-studio-label" htmlFor="lumina-studio-tags">
                        Tags
                      </label>
                      <input
                        id="lumina-studio-tags"
                        type="text"
                        className="post-studio-input"
                        value={tagsText}
                        onChange={(e) => setTagsText(e.target.value)}
                        placeholder="tauri, rust, release"
                      />
                    </div>
                    <div className="post-studio-field">
                      <label className="post-studio-label" htmlFor="lumina-studio-order">
                        Order / Position
                      </label>
                      <input
                        id="lumina-studio-order"
                        type="number"
                        className="post-studio-input"
                        value={sortOrder}
                        onChange={(e) => setSortOrder(Number(e.target.value))}
                        title="Lower numbers appear first"
                      />
                    </div>
                  </div>
                  <div className="post-studio-field">
                    <div className="post-studio-label-row">
                      <label className="post-studio-label" htmlFor="lumina-studio-summary">
                        Summary / Card Excerpt
                      </label>
                      <span className="post-studio-counter">
                        {summary.trim().length} / 580 (auto-filled if left blank)
                      </span>
                    </div>
                    <input
                      id="lumina-studio-summary"
                      type="text"
                      className="post-studio-input"
                      value={summary}
                      maxLength={580}
                      onChange={(e) => setSummary(e.target.value)}
                      placeholder="Short summary displayed on the /lumina/posts card…"
                    />
                  </div>
                </div>
              ) : null}
            </div>

            {/* Rich Formatting Toolbar + Write / Split Editor */}
            <div className="post-studio-field post-studio-field-grow">
              <div className="post-studio-editor-bar">
                <label className="post-studio-label" htmlFor="lumina-studio-content">
                  Markdown Body <span className="post-studio-req">*</span>
                </label>

                <div className="post-studio-snippets">
                  <button
                    type="button"
                    className="post-studio-snippet-btn"
                    title="Bold (Ctrl+B)"
                    onClick={() => applySelectionFormat('**', '**', 'bold')}
                  >
                    <strong>B</strong>
                  </button>
                  <button
                    type="button"
                    className="post-studio-snippet-btn"
                    title="Italic (Ctrl+I)"
                    onClick={() => applySelectionFormat('*', '*', 'italic')}
                  >
                    <em>I</em>
                  </button>
                  <button
                    type="button"
                    className="post-studio-snippet-btn"
                    title="Inline code"
                    onClick={() => applySelectionFormat('`', '`', 'code')}
                  >
                    `code`
                  </button>
                  <button
                    type="button"
                    className="post-studio-snippet-btn"
                    title="Insert link"
                    onClick={() => applySelectionFormat('[', '](https://)', 'link text')}
                  >
                    Link
                  </button>
                  <button
                    type="button"
                    className="post-studio-snippet-btn"
                    onClick={() => insertBlock('## Section Heading\n\nWrite details here.')}
                  >
                    + H2
                  </button>
                  <button
                    type="button"
                    className="post-studio-snippet-btn"
                    onClick={() => insertBlock('### Subsection\n\nWrite details here.')}
                  >
                    + H3
                  </button>
                  <button
                    type="button"
                    className="post-studio-snippet-btn"
                    onClick={() =>
                      insertBlock('> [!NOTE]\n> Highlight an important architectural note or tip.')
                    }
                  >
                    + Callout
                  </button>
                  <button
                    type="button"
                    className="post-studio-snippet-btn"
                    onClick={() => insertBlock('```bash\nnpm run tauri build\n```')}
                  >
                    + Code
                  </button>
                  <button
                    type="button"
                    className="post-studio-snippet-btn"
                    onClick={() =>
                      insertBlock(
                        '| Platform | Installer Format | Architecture |\n| --- | --- | --- |\n| Windows | `.exe` / `.msi` | x64 |\n| macOS | `.dmg` | Universal |\n| Linux | `.deb` / `.AppImage` | x86_64 |',
                      )
                    }
                  >
                    + Table
                  </button>
                </div>
              </div>

              <div className="lumina-studio-editor-grid">
                <textarea
                  ref={textareaRef}
                  id="lumina-studio-content"
                  className={`post-studio-textarea ${touched.content && validation.contentError ? 'is-invalid' : ''}`}
                  value={content}
                  onKeyDown={handleTextareaKeyDown}
                  onBlur={() => setTouched((prev) => ({ ...prev, content: true }))}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Write your Lumina post in Markdown…"
                  required
                />
              </div>

              <div className="post-studio-telemetry">
                <span>
                  {wordCount} words · {readingTime} min read · Shortcut: Ctrl+S to save
                </span>
              </div>

              {touched.content && validation.contentError ? (
                <span className="post-studio-field-error">{validation.contentError}</span>
              ) : null}
            </div>
          </form>
        ) : (
          <div className="post-studio-review-stage">
            <div className="post-studio-review-toolbar">
              <div className="post-studio-viewport-pills" role="tablist">
                {(
                  [
                    { id: 'desktop', label: 'Desktop (100%)' },
                    { id: 'tablet', label: 'Tablet (600px)' },
                    { id: 'mobile', label: 'Mobile (375px)' },
                  ] as const
                ).map((vp) => (
                  <button
                    key={vp.id}
                    type="button"
                    role="tab"
                    aria-selected={viewport === vp.id}
                    className={`post-studio-vp-btn ${viewport === vp.id ? 'is-active' : ''}`}
                    onClick={() => setViewport(vp.id)}
                  >
                    {vp.label}
                  </button>
                ))}
              </div>

              <span className={`post-studio-valid-pill ${validation.isValid ? 'is-ok' : 'is-warn'}`}>
                {validation.isValid ? 'Validated · Ready' : 'Missing required fields'}
              </span>
            </div>

            <div className="post-studio-review-canvas-wrap">
              <div className={`post-studio-review-frame is-${viewport}`}>
                <header className="lumina-doc-header">
                  <div className="lumina-post-meta-bar">
                    <span className="lumina-post-cat-badge">{category}</span>
                    {version.trim() ? (
                      <span className="lumina-post-ver-badge">
                        {version.trim().startsWith('v') ? version.trim() : `v${version.trim()}`}
                      </span>
                    ) : null}
                    <span className="lumina-post-readtime">· {readingTime} min read</span>
                    {parentSlug ? (
                      <span className="lumina-post-sub-badge">
                        ↳ {parentLabel || parentSlug}
                      </span>
                    ) : null}
                  </div>
                  <h1 className="lumina-doc-title">{title.trim() || 'Untitled Lumina Post'}</h1>
                  {summary.trim() ? (
                    <p className="lumina-doc-subtitle">{summary.trim()}</p>
                  ) : null}
                </header>

                <Markdown content={content} />
              </div>
            </div>
          </div>
        )}

        <footer className="post-studio-foot">
          <div className="post-studio-foot-left">
            {isUpdate && post && onDelete ? (
              confirmDelete ? (
                <div className="post-studio-delete-confirm">
                  <button
                    type="button"
                    className="btn btn-small btn-danger"
                    disabled={saving || deleting}
                    onClick={() => void handleDeleteClick(false)}
                  >
                    <span>{deleting ? 'Removing…' : childCount > 0 ? 'Only this post' : 'Delete post'}</span>
                  </button>
                  {childCount > 0 ? (
                    <button
                      type="button"
                      className="btn btn-small btn-danger"
                      disabled={saving || deleting}
                      onClick={() => void handleDeleteClick(true)}
                    >
                      <span>Delete with {childCount} sub-topic{childCount === 1 ? '' : 's'}</span>
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="btn btn-small"
                    disabled={saving || deleting}
                    onClick={() => setConfirmDelete(false)}
                  >
                    <span>Cancel</span>
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="btn btn-small btn-danger post-studio-icon-only-btn"
                  disabled={saving || deleting}
                  onClick={() => setConfirmDelete(true)}
                  aria-label="Delete post"
                  title="Delete post"
                >
                  <TrashIcon size={14} />
                </button>
              )
            ) : null}

            <span
              className={`post-studio-foot-status ${
                !validation.isValid && (touched.title || touched.content) ? 'is-error' : ''
              }`}
            >
              {validation.isValid
                ? `Ready · ${wordCount} words · ${readingTime} min read`
                : validation.titleError ?? validation.contentError}
            </span>
          </div>

          <div className="post-studio-foot-actions">
            <button
              type="button"
              className="btn btn-small"
              disabled={saving || deleting}
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-small btn-primary"
              disabled={saving || deleting}
              onClick={() => void handleSave()}
            >
              <CheckIcon size={13} />
              <span>
                {saving
                  ? isUpdate
                    ? 'Updating…'
                    : 'Publishing…'
                  : isUpdate
                    ? 'Update Post'
                    : status === 'published'
                      ? 'Publish Post'
                      : 'Save Draft'}
              </span>
            </button>
          </div>
        </footer>
      </div>
    </div>
  )
}
