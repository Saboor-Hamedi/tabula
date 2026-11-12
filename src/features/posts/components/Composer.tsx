import { useMemo, useRef, useState } from 'react'
import type { ChatMessage } from '../../../core/types'
import type { Post } from '../../../core/supabase/types'
import { CloseIcon, ImageIcon, PlusIcon, TrashIcon, UploadIcon } from '../../common/Icons'
import { IconButton } from '../../common/IconButton'
import { publishPost } from '../api'
import {
  buildDraftFromAnswer,
  normalizeTags,
  type DraftImage,
} from '../lib/compose'

/**
 * The full publishing form.
 *
 * Everything the quick publish does automatically is editable here: the
 * headline, the standfirst, the cover image, the gallery and the tags.
 */

export interface ComposerProps {
  message: ChatMessage
  datasetName?: string | null
  onClose: () => void
  onPublished?: (post: Post) => void
}

export function Composer({
  message,
  datasetName = null,
  onClose,
  onPublished,
}: ComposerProps) {
  const draft = useMemo(() => buildDraftFromAnswer(message.content), [message.content])

  const [title, setTitle] = useState(draft.title)
  const [subtitle, setSubtitle] = useState(draft.subtitle ?? '')
  const [excerpt, setExcerpt] = useState(draft.excerpt)
  const [tags, setTags] = useState(draft.tags.join(', '))
  const [coverImageUrl, setCoverImageUrl] = useState(draft.coverImageUrl ?? '')
  const [coverCaption, setCoverCaption] = useState('')
  const [images, setImages] = useState<DraftImage[]>(draft.images)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleAddImageUrl = () => {
    const url = window.prompt('Image URL')
    if (!url) return
    setImages((current) => [...current, { url, altText: null, caption: null }])
  }

  const handleRemoveImage = (index: number) => {
    setImages((current) => current.filter((_, position) => position !== index))
  }

  const handleSubmit = async () => {
    if (saving) return
    if (title.trim().length === 0) {
      setError('Give the insight a title before publishing it.')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const post = await publishPost({
        ...draft,
        title: title.trim(),
        subtitle: subtitle.trim().length > 0 ? subtitle.trim() : null,
        excerpt: excerpt.trim(),
        coverImageUrl: coverImageUrl.trim().length > 0 ? coverImageUrl.trim() : null,
        coverCaption: coverCaption.trim().length > 0 ? coverCaption.trim() : null,
        images,
        tags: normalizeTags(tags.split(',')),
        sourceMessageId: message.id,
        model: message.model ?? null,
        datasetName,
      })
      onPublished?.(post)
      onClose()
    } catch (publishError) {
      setError(
        publishError instanceof Error
          ? publishError.message
          : 'The insight could not be published.',
      )
      setSaving(false)
    }
  }

  return (
    <div className="publish-overlay" role="presentation" onClick={onClose}>
      <div
        className="publish-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Publish insight"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="publish-head">
          <div>
            <strong>Publish insight</strong>
            <span>Anyone can read it once it is live.</span>
          </div>
          <IconButton label="Close" size="sm" onClick={onClose}>
            <CloseIcon size={16} />
          </IconButton>
        </header>

        <div className="publish-body">
          <label className="publish-field">
            <span className="publish-label">Title</span>
            <input
              className="publish-input"
              value={title}
              maxLength={240}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="A headline that earns the click"
            />
          </label>

          <label className="publish-field">
            <span className="publish-label">Subtitle</span>
            <input
              className="publish-input"
              value={subtitle}
              maxLength={240}
              onChange={(event) => setSubtitle(event.target.value)}
              placeholder="Optional standfirst"
            />
          </label>

          <label className="publish-field">
            <span className="publish-label">Summary</span>
            <textarea
              className="publish-textarea"
              value={excerpt}
              rows={3}
              maxLength={400}
              onChange={(event) => setExcerpt(event.target.value)}
              placeholder="How it appears in the feed"
            />
          </label>

          <label className="publish-field">
            <span className="publish-label">Tags</span>
            <input
              className="publish-input"
              value={tags}
              onChange={(event) => setTags(event.target.value)}
              placeholder="revenue, retention, q3"
            />
          </label>

          <div className="publish-field">
            <span className="publish-label">Cover image</span>
            <div className="publish-row">
              <input
                className="publish-input"
                value={coverImageUrl}
                onChange={(event) => setCoverImageUrl(event.target.value)}
                placeholder="https://…"
              />
              <button
                type="button"
                className="btn btn-small"
                onClick={() => fileInputRef.current?.click()}
                title="Upload from this device"
              >
                <UploadIcon size={14} />
                <span>Upload</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (!file) return
                  const reader = new FileReader()
                  reader.onload = () => {
                    const result = typeof reader.result === 'string' ? reader.result : ''
                    if (result) setCoverImageUrl(result)
                  }
                  reader.readAsDataURL(file)
                  event.target.value = ''
                }}
              />
            </div>
            {coverImageUrl ? (
              <div className="publish-preview">
                <img src={coverImageUrl} alt="Cover preview" />
              </div>
            ) : null}
          </div>

          <label className="publish-field">
            <span className="publish-label">Cover caption</span>
            <input
              className="publish-input"
              value={coverCaption}
              onChange={(event) => setCoverCaption(event.target.value)}
              placeholder="Optional caption"
            />
          </label>

          <div className="publish-field">
            <span className="publish-label">
              Gallery <em>{images.length}</em>
            </span>
            <div className="publish-gallery">
              {images.map((image, index) => (
                <div className="publish-gallery-item" key={`${image.url}-${index}`}>
                  <img src={image.url} alt={image.altText ?? ''} />
                  <button
                    type="button"
                    className="publish-gallery-remove"
                    onClick={() => handleRemoveImage(index)}
                    title="Remove image"
                  >
                    <TrashIcon size={12} />
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="publish-gallery-add"
                onClick={handleAddImageUrl}
              >
                <PlusIcon size={14} />
                <span>Add</span>
              </button>
            </div>
            <p className="publish-hint">
              <ImageIcon size={12} /> Images inside the answer are picked up
              automatically.
            </p>
          </div>
        </div>

        <footer className="publish-foot">
          {error ? (
            <span className="publish-error" role="alert">
              {error}
            </span>
          ) : (
            <span className="publish-hint">
              {draft.readingTimeMinutes} min read · {draft.blocks.length} blocks
            </span>
          )}
          <div className="publish-foot-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void handleSubmit()}
              disabled={saving}
            >
              {saving ? 'Publishing…' : 'Publish now'}
            </button>
          </div>
        </footer>
      </div>
    </div>
  )
}
