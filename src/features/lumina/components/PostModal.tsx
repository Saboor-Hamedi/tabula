import { useEffect, useMemo, useState } from 'react'
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
  defaultVersion?: string | null
  onClose: () => void
  onSaved?: (saved: LuminaPost) => void
  onDelete?: (post: LuminaPost) => Promise<void> | void
}

type StudioTab = 'edit' | 'review'
type ReviewViewport = 'desktop' | 'tablet' | 'mobile'

const CATEGORIES: LuminaPostCategory[] = [
  'Release',
  'Guide',
  'Feature',
  'Announcement',
]

export function PostModal({
  post = null,
  mode = post ? 'update' : 'create',
  defaultVersion = null,
  onClose,
  onSaved,
  onDelete,
}: PostModalProps) {
  const isUpdate = mode === 'update' && Boolean(post)

  const [title, setTitle] = useState(() => post?.title ?? '')
  const [slug, setSlug] = useState(() => post?.slug ?? '')
  const [slugTouched, setSlugTouched] = useState(() => Boolean(post?.slug))
  const [category, setCategory] = useState<LuminaPostCategory>(() => post?.category ?? 'Release')
  const [version, setVersion] = useState(() => post?.version ?? defaultVersion ?? '')
  const [summary, setSummary] = useState(() => post?.summary ?? '')
  const [tagsText, setTagsText] = useState(() => (post?.tags ?? []).join(', '))
  const [status, setStatus] = useState<LuminaPostStatus>(() => post?.status ?? 'published')
  const [content, setContent] = useState(() => post?.content ?? '')

  const [activeTab, setActiveTab] = useState<StudioTab>('edit')
  const [viewport, setViewport] = useState<ReviewViewport>('desktop')
  const [touched, setTouched] = useState<{ title?: boolean; content?: boolean }>({})
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!slugTouched) {
      setSlug(slugifyLuminaTitle(title))
    }
  }, [title, slugTouched])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving && !deleting) {
        onClose()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose, saving, deleting])

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

  const insertSnippet = (kind: 'heading' | 'callout' | 'code' | 'table') => {
    const snippets: Record<typeof kind, string> = {
      heading: '\n## Section Heading\n\nWrite details here.\n',
      callout: '\n> [!NOTE]\n> Highlight an important architectural detail or release note.\n',
      code: '\n```bash\nnpm run tauri build\n```\n',
      table:
        '\n| Platform | Installer Format | Architecture |\n| --- | --- | --- |\n| Windows | `.exe` / `.msi` | x64 |\n| macOS | `.dmg` | Universal (Apple Silicon + Intel) |\n| Linux | `.deb` / `.AppImage` | x86_64 |\n',
    }
    setContent((prev) => `${prev.trimEnd()}\n${snippets[kind]}`)
    setTouched((prev) => ({ ...prev, content: true }))
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
        version: version.trim() || null,
        summary: summary.trim() || deriveMarkdownSummary(content),
        content,
        tags: normalizedTags,
      })
      onSaved?.(saved)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save Lumina post.')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteClick = async () => {
    if (!post || !onDelete) return
    setDeleting(true)
    setError(null)
    try {
      await onDelete(post)
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
      aria-label={isUpdate ? 'Update Lumina Post' : 'Create Lumina Post'}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving && !deleting) {
          onClose()
        }
      }}
    >
      <div className="post-studio-modal" onClick={(e) => e.stopPropagation()}>
        <header className="post-studio-head">
          <div className="post-studio-head-titles">
            <h2 className="post-studio-title">
              {isUpdate ? 'Update Lumina Post' : 'Create Lumina Post'}
            </h2>
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
                <span>Edit</span>
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

        {error ? (
          <div className="post-studio-alert" role="alert">
            <AlertIcon size={14} />
            <span>{error}</span>
          </div>
        ) : null}

        {activeTab === 'edit' ? (
          <form className="post-studio-body" onSubmit={(e) => void handleSave(e)} noValidate>
            {/* Title & Slug */}
            <div className="post-studio-grid-2">
              <div className="post-studio-field">
                <div className="post-studio-label-row">
                  <label className="post-studio-label" htmlFor="lumina-studio-title">
                    Post Title <span className="post-studio-req">*</span>
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
                  placeholder="e.g. Lumina Release Notes: 3D Graph & ConPTY Terminal"
                  required
                />
                {touched.title && validation.titleError ? (
                  <span className="post-studio-field-error">{validation.titleError}</span>
                ) : null}
              </div>

              <div className="post-studio-field">
                <div className="post-studio-label-row">
                  <label className="post-studio-label" htmlFor="lumina-studio-slug">
                    URL Slug <span className="post-studio-req">*</span>
                  </label>
                </div>
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
                  required
                />
              </div>
            </div>

            {/* Category, Version & Visibility */}
            <div className="post-studio-grid-2">
              <div className="post-studio-field">
                <div className="post-studio-label-row">
                  <label className="post-studio-label" htmlFor="lumina-studio-category">
                    Category &amp; Version
                  </label>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
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
                  <input
                    type="text"
                    className="post-studio-input"
                    value={version}
                    onChange={(e) => setVersion(e.target.value)}
                    placeholder={defaultVersion ? `Version (${defaultVersion})` : 'Version (optional)'}
                  />
                </div>
              </div>

              <div className="post-studio-field">
                <div className="post-studio-label-row">
                  <label className="post-studio-label" htmlFor="lumina-studio-status">
                    Visibility &amp; Tags
                  </label>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
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
                  <input
                    type="text"
                    className="post-studio-input"
                    value={tagsText}
                    onChange={(e) => setTagsText(e.target.value)}
                    placeholder="tauri, rust, release"
                  />
                </div>
              </div>
            </div>

            {/* Summary */}
            <div className="post-studio-field">
              <div className="post-studio-label-row">
                <label className="post-studio-label" htmlFor="lumina-studio-summary">
                  Summary / Excerpt
                </label>
                <span className="post-studio-counter">{summary.trim().length} / 580</span>
              </div>
              <input
                id="lumina-studio-summary"
                type="text"
                className="post-studio-input"
                value={summary}
                maxLength={580}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="Short summary displayed on the /lumina/posts card (auto-derived if left blank)…"
              />
            </div>

            {/* Markdown Content */}
            <div className="post-studio-field post-studio-field-grow">
              <div className="post-studio-editor-bar">
                <label className="post-studio-label" htmlFor="lumina-studio-content">
                  Markdown Content <span className="post-studio-req">*</span>
                </label>

                <div className="post-studio-snippets">
                  <button
                    type="button"
                    className="post-studio-snippet-btn"
                    onClick={() => insertSnippet('heading')}
                  >
                    + Heading
                  </button>
                  <button
                    type="button"
                    className="post-studio-snippet-btn"
                    onClick={() => insertSnippet('callout')}
                  >
                    + Callout
                  </button>
                  <button
                    type="button"
                    className="post-studio-snippet-btn"
                    onClick={() => insertSnippet('code')}
                  >
                    + Code
                  </button>
                  <button
                    type="button"
                    className="post-studio-snippet-btn"
                    onClick={() => insertSnippet('table')}
                  >
                    + Table
                  </button>
                </div>
              </div>

              <textarea
                id="lumina-studio-content"
                className={`post-studio-textarea ${touched.content && validation.contentError ? 'is-invalid' : ''}`}
                value={content}
                onBlur={() => setTouched((prev) => ({ ...prev, content: true }))}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Write release changelog, guide, or announcement in Markdown…"
                required
              />

              <div className="post-studio-telemetry">
                <span>
                  {wordCount} words · {readingTime} min read
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
                    onClick={() => void handleDeleteClick()}
                  >
                    <span>{deleting ? 'Removing…' : 'Confirm'}</span>
                  </button>
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
                    : 'Creating…'
                  : isUpdate
                    ? 'Update Post'
                    : 'Create Post'}
              </span>
            </button>
          </div>
        </footer>
      </div>
    </div>
  )
}
