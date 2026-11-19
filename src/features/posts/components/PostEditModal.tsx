import { useEffect, useMemo, useState } from 'react'
import { hasOpenFence } from '../../../core/parsing/parseMessage'
import type { Post, PostStatus } from '../../../core/supabase/types'
import { useDisplayName } from '../../auth/display'
import { useAuthUser, useProfile } from '../../auth/useProfile'
import {
  AlertIcon,
  CheckIcon,
  EyeIcon,
  PencilIcon,
  TrashIcon,
} from '../../common/Icons'
import { publishPost, updatePost } from '../api'
import {
  blocksToMarkdown,
  countWords,
  deriveExcerpt,
  deriveTitle,
  estimateReadingTime,
  findAllImages,
  normalizeTags,
  parseBlocks,
  resolveFullPostTitle,
  type DraftImage,
} from '../lib'
import { Content } from './Content'

export interface PostEditModalProps {
  /** Existing post when updating; omit when creating a new post. */
  post?: Post | null
  mode?: 'update' | 'create'
  /** Optional initial markdown when creating a post from a workspace answer. */
  initialContent?: string
  initialDatasetName?: string | null
  sourceMessageId?: string | null
  sourceModel?: string | null
  onClose: () => void
  onUpdated?: (updated: Post) => void
  onCreated?: (created: Post) => void
  onDelete?: (post: Post) => Promise<void> | void
}

type StudioTab = 'edit' | 'review'
type ReviewViewport = 'desktop' | 'tablet' | 'mobile'

export function PostEditModal({
  post = null,
  mode = post ? 'update' : 'create',
  initialContent = '',
  initialDatasetName = null,
  sourceMessageId = null,
  sourceModel = null,
  onClose,
  onUpdated,
  onCreated,
  onDelete,
}: PostEditModalProps) {
  const isUpdate = mode === 'update' && Boolean(post)
  const authorName = useDisplayName()
  const profile = useProfile()
  const user = useAuthUser()
  const avatarUrl =
    post?.author_avatar_url ??
    profile?.avatar_url ??
    (user?.user_metadata?.avatar_url as string | undefined) ??
    null

  const initialMarkdown = useMemo(() => {
    if (post) return blocksToMarkdown(post.blocks, post.content)
    return initialContent
  }, [post, initialContent])

  const [title, setTitle] = useState(() => {
    if (post) return resolveFullPostTitle(post)
    if (initialContent.trim()) return deriveTitle(initialContent)
    return ''
  })
  const [tagsText, setTagsText] = useState(() => (post?.tags ?? []).join(', '))
  const [content, setContent] = useState(initialMarkdown)
  const [status, setStatus] = useState<PostStatus>(() => post?.status ?? 'published')

  const [activeTab, setActiveTab] = useState<StudioTab>('edit')
  const [viewport, setViewport] = useState<ReviewViewport>('desktop')
  const [touched, setTouched] = useState<{ title?: boolean; content?: boolean; tags?: boolean }>({})
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving && !deleting) {
        onClose()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose, saving, deleting])

  const rawTagTokens = useMemo(
    () =>
      tagsText
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
    [tagsText],
  )

  const normalizedTags = useMemo(() => normalizeTags(rawTagTokens), [rawTagTokens])

  const parsedBlocks = useMemo(() => parseBlocks(content), [content])
  const wordCount = useMemo(() => countWords(content), [content])
  const readingTime = useMemo(() => estimateReadingTime(content), [content])
  const openFenceWarning = useMemo(() => hasOpenFence(content), [content])

  const validation = useMemo(() => {
    const cleanTitle = title.trim()
    const cleanContent = content.trim()
    const hasAlphaNumericTitle = /[a-zA-Z0-9]/.test(cleanTitle)

    const titleError =
      cleanTitle.length === 0
        ? 'Post title is required.'
        : cleanTitle.length < 3
          ? 'Post title must be at least 3 characters.'
          : !hasAlphaNumericTitle
            ? 'Post title must include letters or numbers.'
            : cleanTitle.length > 240
              ? 'Post title cannot exceed 240 characters.'
              : null

    const contentError =
      cleanContent.length === 0
        ? 'Post content is required.'
        : cleanContent.length < 10
          ? 'Post content must be at least 10 characters.'
          : openFenceWarning
            ? 'Close the open ``` code fence before saving.'
            : null

    const tagsError =
      rawTagTokens.length > 8
        ? 'Maximum 8 topic tags allowed (extra tags will be ignored).'
        : null

    return {
      titleError,
      contentError,
      tagsError,
      isValid: !titleError && !contentError,
    }
  }, [title, content, openFenceWarning, rawTagTokens.length])

  const removeTag = (tagToRemove: string) => {
    const next = normalizedTags.filter((t) => t !== tagToRemove)
    setTagsText(next.join(', '))
  }

  const insertSnippet = (kind: 'heading' | 'table' | 'mermaid') => {
    const snippets: Record<typeof kind, string> = {
      heading: '\n## Section Heading\n\nWrite your analysis here.\n',
      table:
        '\n| Metric | Q2 | Q3 | Change |\n| --- | ---: | ---: | ---: |\n| Revenue | $4.2M | $5.1M | +21.4% |\n| Margin | 18.2% | 22.0% | +3.8% |\n',
      mermaid:
        '\n```mermaid\nflowchart LR\n  A["Raw Dataset"] --> B["DuckDB Query"]\n  B --> C["Verified Insight"]\n```\n',
    }
    setContent((prev) => `${prev.trimEnd()}\n${snippets[kind]}`)
    setTouched((prev) => ({ ...prev, content: true }))
  }

  const handleSave = async (event?: React.FormEvent) => {
    event?.preventDefault()
    setTouched({ title: true, content: true, tags: true })

    if (!validation.isValid) {
      setError(
        validation.titleError ??
          validation.contentError ??
          'Please fix the highlighted fields before saving.',
      )
      return
    }

    setSaving(true)
    setError(null)

    try {
      const autoExcerpt = deriveExcerpt(content)

      if (isUpdate && post) {
        const updated = await updatePost(post.id, {
          title: title.trim(),
          subtitle: post.subtitle ?? null,
          excerpt: autoExcerpt,
          content,
          coverImageUrl: post.cover_image_url ?? null,
          coverCaption: post.cover_caption ?? null,
          tags: normalizedTags,
          status,
        })
        onUpdated?.(updated)
        onClose()
      } else {
        const inlineImages: DraftImage[] = findAllImages(content)
        const created = await publishPost({
          title: title.trim(),
          subtitle: null,
          excerpt: autoExcerpt,
          content,
          blocks: parsedBlocks,
          coverImageUrl: inlineImages[0]?.url ?? null,
          coverCaption: null,
          images: inlineImages,
          tags: normalizedTags,
          readingTimeMinutes: readingTime,
          sourceMessageId,
          model: sourceModel,
          datasetName: initialDatasetName,
          status,
        })
        onCreated?.(created)
        onClose()
      }
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : isUpdate
            ? 'Could not update the post.'
            : 'Could not create the post.',
      )
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
    } catch (delError) {
      setError(
        delError instanceof Error ? delError.message : 'Could not delete the post.',
      )
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  const displayAuthor = post?.author_name ?? authorName ?? 'Lumina Tabula'
  const displayInitial = displayAuthor.trim().charAt(0).toUpperCase() || 'T'

  return (
    <div
      className="post-studio-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={isUpdate ? 'Update Post' : 'Create Post'}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving && !deleting) {
          onClose()
        }
      }}
    >
      <div className="post-studio-modal" onClick={(e) => e.stopPropagation()}>
        {/* Top Studio Bar — Only Title & Edit/Preview Switch (no duplicate close button) */}
        <header className="post-studio-head">
          <div className="post-studio-head-titles">
            <h2 className="post-studio-title">
              {isUpdate ? 'Update Post' : 'Create Post'}
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
                  setTouched({ title: true, content: true, tags: true })
                  setActiveTab('review')
                }}
              >
                <EyeIcon size={12} />
                <span>Preview</span>
              </button>
            </div>
          </div>
        </header>

        {/* Global Error Banner */}
        {error ? (
          <div className="post-studio-alert" role="alert">
            <AlertIcon size={14} />
            <span>{error}</span>
          </div>
        ) : null}

        {/* Body: Equal-Height Editor & Responsive Preview */}
        {activeTab === 'edit' ? (
          <form className="post-studio-body" onSubmit={(e) => void handleSave(e)} noValidate>
            {/* Title */}
            <div className="post-studio-field">
              <div className="post-studio-label-row">
                <label className="post-studio-label" htmlFor="post-studio-title-input">
                  Post Title <span className="post-studio-req">*</span>
                </label>
                <span
                  className={`post-studio-counter ${
                    touched.title && validation.titleError ? 'is-error' : ''
                  }`}
                >
                  {title.trim().length} / 240
                </span>
              </div>
              <input
                id="post-studio-title-input"
                type="text"
                className={`post-studio-input ${touched.title && validation.titleError ? 'is-invalid' : ''}`}
                value={title}
                maxLength={240}
                onBlur={() => setTouched((prev) => ({ ...prev, title: true }))}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter a clear, descriptive post title"
                required
              />
              {touched.title && validation.titleError ? (
                <span className="post-studio-field-error">{validation.titleError}</span>
              ) : null}
            </div>

            {/* Clean 2-Column Row: Topic Tags + Visibility Status */}
            <div className="post-studio-grid-2">
              <div className="post-studio-field">
                <div className="post-studio-label-row">
                  <label className="post-studio-label" htmlFor="post-studio-tags-input">
                    Topic Tags
                  </label>
                  <span className="post-studio-counter">{normalizedTags.length} / 8</span>
                </div>
                <input
                  id="post-studio-tags-input"
                  type="text"
                  className="post-studio-input"
                  value={tagsText}
                  onBlur={() => setTouched((prev) => ({ ...prev, tags: true }))}
                  onChange={(e) => setTagsText(e.target.value)}
                  placeholder="revenue, retention, duckdb (comma-separated)"
                />
                {normalizedTags.length > 0 ? (
                  <div className="post-studio-tag-preview">
                    {normalizedTags.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        className="post-tag post-studio-tag-chip"
                        onClick={() => removeTag(tag)}
                        title={`Remove #${tag}`}
                      >
                        <span>{tag}</span>
                        <span className="post-studio-tag-x" aria-hidden>
                          ×
                        </span>
                      </button>
                    ))}
                  </div>
                ) : null}
                {validation.tagsError ? (
                  <span className="post-studio-field-warn">{validation.tagsError}</span>
                ) : null}
              </div>

              <div className="post-studio-field">
                <div className="post-studio-label-row">
                  <label className="post-studio-label" htmlFor="post-studio-status-select">
                    Visibility
                  </label>
                </div>
                <select
                  id="post-studio-status-select"
                  className="post-studio-select"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as PostStatus)}
                >
                  <option value="published">Published (Live)</option>
                  <option value="draft">Draft (Admin only)</option>
                  <option value="archived">Archived (Hidden)</option>
                </select>
              </div>
            </div>

            {/* Content Editor — Flex-grow so Edit and Preview have identical height */}
            <div className="post-studio-field post-studio-field-grow">
              <div className="post-studio-editor-bar">
                <label className="post-studio-label" htmlFor="post-studio-content-area">
                  Content (Markdown, Tables &amp; Mermaid) <span className="post-studio-req">*</span>
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
                    onClick={() => insertSnippet('table')}
                  >
                    + Table
                  </button>
                  <button
                    type="button"
                    className="post-studio-snippet-btn"
                    onClick={() => insertSnippet('mermaid')}
                  >
                    + Mermaid
                  </button>
                </div>
              </div>

              <textarea
                id="post-studio-content-area"
                className={`post-studio-textarea ${touched.content && validation.contentError ? 'is-invalid' : ''}`}
                value={content}
                onBlur={() => setTouched((prev) => ({ ...prev, content: true }))}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Write markdown prose, GFM pipe tables, and ```mermaid diagrams…"
                required
              />

              <div className="post-studio-telemetry">
                <span>
                  {wordCount} words · {readingTime} min read · {parsedBlocks.length} block
                  {parsedBlocks.length === 1 ? '' : 's'}
                </span>
                {openFenceWarning ? (
                  <span className="post-studio-fence-warn">
                    Unclosed ``` code fence detected — close it with ``` to render diagrams.
                  </span>
                ) : null}
              </div>

              {touched.content && validation.contentError ? (
                <span className="post-studio-field-error">{validation.contentError}</span>
              ) : null}
            </div>
          </form>
        ) : (
          /* Responsive Preview Tab — Identical modal dimensions */
          <div className="post-studio-review-stage">
            <div className="post-studio-review-toolbar">
              <div className="post-studio-viewport-pills" role="tablist" aria-label="Preview viewport size">
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
                <header className="post-article-header">
                  {normalizedTags.length > 0 ? (
                    <div className="post-card-tags">
                      {normalizedTags.map((tag) => (
                        <span className="post-tag" key={tag}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  ) : null}

                  <h1 className="post-article-title">
                    {title.trim() || 'Untitled Post Preview'}
                  </h1>

                  <div className="post-fb-header-row">
                    <div className="post-fb-author-group">
                      {avatarUrl ? (
                        <img className="post-avatar post-avatar-lg" src={avatarUrl} alt="" />
                      ) : (
                        <span className="post-avatar post-avatar-lg is-fallback" aria-hidden>
                          {displayInitial}
                        </span>
                      )}
                      <div className="post-fb-author-stack">
                        <span className="post-fb-author-name">{displayAuthor}</span>
                        <div className="post-fb-date-row">
                          <span className="post-card-date">Just now</span>
                          <span className="post-dot" aria-hidden>
                            ·
                          </span>
                          <span>{readingTime} min read</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </header>

                <Content blocks={parsedBlocks} />
              </div>
            </div>
          </div>
        )}

        {/* Sticky Footer — Only Delete (icon-only), Status, Cancel, and Submit */}
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
