import { useRef, useState, type DragEvent } from 'react'
import { ACCEPTED_EXTENSIONS } from '../../core/constants'
import { AlertIcon, SheetIcon, UploadIcon } from '../common/Icons'
import { useSessionActions, useSessionState } from '../SessionProvider'
import { UploadStatus } from './UploadStatus'

/**
 * Empty state: the drop target.
 *
 * Deliberately quiet. A dashed drop area, one line of copy, and the format
 * limits. No feature grid, no marketing headline — the product is the chat that
 * comes after the upload.
 */

export function UploadZone() {
  const { upload, dbError } = useSessionState()
  const { uploadFile } = useSessionActions()
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [sampleLoading, setSampleLoading] = useState(false)

  const busy = upload.phase === 'reading' || upload.phase === 'ingesting'

  const loadSample = async () => {
    setSampleLoading(true)
    try {
      const response = await fetch('/orders.csv')
      if (!response.ok) throw new Error('The sample dataset could not be loaded.')
      const blob = await response.blob()
      await uploadFile(new File([blob], 'orders.csv', { type: 'text/csv' }))
    } finally {
      setSampleLoading(false)
    }
  }

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return
    void uploadFile(files[0])
  }

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    setDragging(false)
    if (!busy) handleFiles(event.dataTransfer.files)
  }

  const onDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    if (!busy) setDragging(true)
  }

  const onDragLeave = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    setDragging(false)
  }

  return (
    <div className="empty-screen">
      <div className="empty-inner">
        <div className="empty-mark" aria-hidden>
          <SheetIcon size={22} />
        </div>

        <h1 className="empty-title">Ask your spreadsheet anything</h1>
        <p className="empty-sub">
          Drop a CSV or Excel workbook. Tabula reads the columns, profiles the values, and answers
          with clear findings, charts, and tables. Your file never leaves this browser.
        </p>

        <div
          className={`drop-zone ${dragging ? 'is-dragging' : ''} ${busy ? 'is-busy' : ''}`}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onClick={() => !busy && inputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(event) => {
            if ((event.key === 'Enter' || event.key === ' ') && !busy) {
              event.preventDefault()
              inputRef.current?.click()
            }
          }}
          aria-label="Upload a CSV or Excel file"
        >
          <UploadIcon size={20} />
          <span className="drop-zone-title">
            {busy ? 'Working…' : 'Drop a file, or browse'}
          </span>
          <span className="drop-zone-meta">
            {ACCEPTED_EXTENSIONS.map((extension) => extension.slice(1).toUpperCase()).join(' · ')}
            {'  ·  up to 80 MB  ·  all sheets imported'}
          </span>

          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED_EXTENSIONS.join(',')}
            className="visually-hidden"
            onChange={(event) => {
              handleFiles(event.target.files)
              event.target.value = ''
            }}
          />
        </div>

        <UploadStatus state={upload} />

        <button
          type="button"
          className="sample-btn"
          onClick={() => void loadSample()}
          disabled={busy || sampleLoading}
        >
          {sampleLoading ? 'Loading sample…' : 'Try a sample dataset'}
        </button>

        {dbError ? (
          <div className="upload-status is-error" role="alert">
            <AlertIcon size={15} />
            <div>
              <strong>The analysis engine could not start</strong>
              <span>{dbError}</span>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
