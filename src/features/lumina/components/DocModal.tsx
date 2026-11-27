import { useEffect, useState } from 'react'
import { AlertIcon, CheckIcon, EyeIcon, PencilIcon } from '../../common/Icons'
import {
  saveLuminaDoc,
  type LuminaDocRecord,
  type LuminaDocSection,
} from '../api/docs'
import { slugifyLuminaTitle } from '../api/posts'
import { Markdown } from './Markdown'

export interface DocModalProps {
  doc?: LuminaDocRecord | null
  onClose: () => void
  onSaved?: (saved: LuminaDocRecord) => void
}

const SECTIONS: LuminaDocSection[] = ['Prologue', 'Features', 'Reference', 'Legal']

export function DocModal({ doc = null, onClose, onSaved }: DocModalProps) {
  const isUpdate = Boolean(doc?.slug)
  const [title, setTitle] = useState(() => doc?.title ?? '')
  const [slug, setSlug] = useState(() => doc?.slug ?? '')
  const [slugTouched, setSlugTouched] = useState(() => Boolean(doc?.slug))
  const [section, setSection] = useState<LuminaDocSection>(() => doc?.section ?? 'Features')
  const [subtitle, setSubtitle] = useState(() => doc?.subtitle ?? '')
  const [sortOrder, setSortOrder] = useState(() => doc?.sort_order ?? 100)
  const [published, setPublished] = useState(() => doc?.published ?? true)
  const [content, setContent] = useState(() => doc?.content ?? '')
  const [activeTab, setActiveTab] = useState<'edit' | 'review'>('edit')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!slugTouched) {
      setSlug(slugifyLuminaTitle(title))
    }
  }, [title, slugTouched])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose, saving])

  const handleSave = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!title.trim() || !content.trim()) {
      setError('Title and Markdown content are required.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const saved = await saveLuminaDoc({
        slug: slug.trim() || slugifyLuminaTitle(title),
        section,
        title: title.trim(),
        subtitle: subtitle.trim() || null,
        summary: subtitle.trim() || null,
        content,
        sort_order: Number(sortOrder) || 100,
        published,
      })
      onSaved?.(saved)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save documentation page.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="post-studio-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={isUpdate ? 'Edit Lumina Documentation' : 'Create Lumina Documentation'}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) onClose()
      }}
    >
      <div className="post-studio-modal" onClick={(e) => e.stopPropagation()}>
        <header className="post-studio-head">
          <div className="post-studio-head-titles">
            <h2 className="post-studio-title">
              {isUpdate ? `Edit Doc: ${doc?.title}` : 'Create Documentation Page'}
            </h2>
          </div>

          <div className="post-studio-head-controls">
            <div className="post-studio-mode-switch" role="tablist">
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
                onClick={() => setActiveTab('review')}
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
            <div className="post-studio-grid-2">
              <div className="post-studio-field">
                <label className="post-studio-label">Page Title *</label>
                <input
                  type="text"
                  className="post-studio-input"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>

              <div className="post-studio-field">
                <label className="post-studio-label">Doc Slug *</label>
                <input
                  type="text"
                  className="post-studio-input"
                  value={slug}
                  onChange={(e) => {
                    setSlugTouched(true)
                    setSlug(slugifyLuminaTitle(e.target.value))
                  }}
                  required
                />
              </div>
            </div>

            <div className="post-studio-grid-2">
              <div className="post-studio-field">
                <label className="post-studio-label">Sidebar Section &amp; Order</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px', gap: 8 }}>
                  <select
                    className="post-studio-select"
                    value={section}
                    onChange={(e) => setSection(e.target.value as LuminaDocSection)}
                  >
                    {SECTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    className="post-studio-input"
                    value={sortOrder}
                    onChange={(e) => setSortOrder(Number(e.target.value))}
                    title="Sort order"
                  />
                </div>
              </div>

              <div className="post-studio-field">
                <label className="post-studio-label">Visibility</label>
                <select
                  className="post-studio-select"
                  value={published ? 'published' : 'draft'}
                  onChange={(e) => setPublished(e.target.value === 'published')}
                >
                  <option value="published">Published (Public)</option>
                  <option value="draft">Draft (Hidden)</option>
                </select>
              </div>
            </div>

            <div className="post-studio-field">
              <label className="post-studio-label">Subtitle</label>
              <input
                type="text"
                className="post-studio-input"
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
              />
            </div>

            <div className="post-studio-field post-studio-field-grow">
              <label className="post-studio-label">Markdown Content *</label>
              <textarea
                className="post-studio-textarea"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                required
              />
            </div>
          </form>
        ) : (
          <div className="post-studio-review-stage">
            <div className="post-studio-review-canvas-wrap">
              <div className="post-studio-review-frame is-desktop">
                <header className="lumina-doc-header">
                  <span className="lumina-doc-kicker">{section}</span>
                  <h1 className="lumina-doc-title">{title || 'Untitled Documentation'}</h1>
                  {subtitle ? <p className="lumina-doc-subtitle">{subtitle}</p> : null}
                </header>
                <Markdown content={content} />
              </div>
            </div>
          </div>
        )}

        <footer className="post-studio-foot">
          <div className="post-studio-foot-left">
            <span className="post-studio-foot-status">
              Table: public.lumina_docs · Slug: {slug || 'auto'}
            </span>
          </div>
          <div className="post-studio-foot-actions">
            <button
              type="button"
              className="btn btn-small"
              disabled={saving}
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-small btn-primary"
              disabled={saving}
              onClick={() => void handleSave()}
            >
              <CheckIcon size={13} />
              <span>{saving ? 'Saving…' : 'Save Documentation'}</span>
            </button>
          </div>
        </footer>
      </div>
    </div>
  )
}
