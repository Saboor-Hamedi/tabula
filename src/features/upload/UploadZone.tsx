import { useRef, useState, type DragEvent } from 'react'
import { ACCEPTED_EXTENSIONS } from '../../core/constants'
import {
  ActivityIcon,
  AlertIcon,
  BarChartIcon,
  DatabaseIcon,
  FileIcon,
  SearchIcon,
  TableIcon,
  UploadIcon,
} from '../common/Icons'
import { useSessionActions, useSessionState } from '../SessionProvider'
import { UploadStatus } from './UploadStatus'

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
        {/* 1. NotebookLM-Style Studio Welcome Header */}
        <div className="workspace-welcome-head">
          <div className="workspace-welcome-mark">
            <DatabaseIcon size={20} />
          </div>
          <h1 className="workspace-welcome-title">Add sources to get started</h1>
          <p className="workspace-welcome-subtitle">
            Upload your spreadsheets, CSV, or Excel workbooks. Ask questions, explore trends, and generate executive summaries.
          </p>
        </div>

        {/* 2. Drag and Drop Area with Small Sample Dataset Link */}
        <div className="workspace-upload-area">
          {/* Main Drop Area Card */}
          <div
            className={`source-drop-card ${dragging ? 'is-dragging' : ''} ${busy ? 'is-busy' : ''}`}
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
            aria-label="Upload a spreadsheet"
          >
            <div className="source-drop-icon">
              <UploadIcon size={26} />
            </div>
            <div className="source-drop-main">
              <span className="source-drop-title">
                {busy ? 'Reading file…' : 'Drop spreadsheet here, or browse'}
              </span>
              <span className="source-drop-sub">
                Supports Excel (.xlsx), CSV, and TSV up to millions of rows
              </span>
            </div>
            <div className="source-drop-formats">
              {ACCEPTED_EXTENSIONS.map((ext) => (
                <span key={ext} className="format-badge">
                  {ext.slice(1).toUpperCase()}
                </span>
              ))}
              <span className="format-badge-private">100% Client-Side</span>
            </div>

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

          {/* Small Sample Dataset Action Under Drag and Drop */}
          <div className="sample-dataset-small">
            <span className="sample-dataset-hint">No file right now?</span>
            <button
              type="button"
              className="sample-dataset-btn"
              onClick={() => void loadSample()}
              disabled={busy || sampleLoading}
            >
              <FileIcon size={13} />
              <span>{sampleLoading ? 'Loading sample…' : 'Try a sample dataset'}</span>
              <span className="sample-dataset-tag">orders.csv · 420 rows</span>
            </button>
          </div>
        </div>

        {/* Upload Status Bar (if reading/ingesting) */}
        <UploadStatus state={upload} />

        {/* Database Error Banner (if any) */}
        {dbError ? (
          <div className="upload-status is-error" role="alert">
            <AlertIcon size={15} />
            <div>
              <strong>The analysis engine could not start</strong>
              <span>{dbError}</span>
            </div>
          </div>
        ) : null}

        {/* 4. NotebookLM-Style Suggested Capabilities Guide */}
        <div className="workspace-guide-section">
          <span className="workspace-guide-label">What you can ask Tabula once sources are added:</span>
          <div className="workspace-guide-grid">
            <div className="guide-card">
              <div className="guide-card-icon">
                <ActivityIcon size={15} />
              </div>
              <div className="guide-card-text">
                <strong>Trend & Growth Tracking</strong>
                <span>Compare monthly revenue, churn cohorts, and regional volume.</span>
              </div>
            </div>

            <div className="guide-card">
              <div className="guide-card-icon">
                <SearchIcon size={15} />
              </div>
              <div className="guide-card-text">
                <strong>Anomaly & Outlier Detection</strong>
                <span>Find suspicious spikes, missing entries, and unexpected margins.</span>
              </div>
            </div>

            <div className="guide-card">
              <div className="guide-card-icon">
                <BarChartIcon size={15} />
              </div>
              <div className="guide-card-text">
                <strong>Instant Visual Distributions</strong>
                <span>Auto-generate comparative charts, histograms, and category rankings.</span>
              </div>
            </div>

            <div className="guide-card">
              <div className="guide-card-icon">
                <TableIcon size={15} />
              </div>
              <div className="guide-card-text">
                <strong>Executive Briefing Dossiers</strong>
                <span>Generate structured summary reports with findings and export to PDF.</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
