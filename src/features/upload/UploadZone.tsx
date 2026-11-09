import { useRef, useState, type DragEvent } from 'react'
import { ACCEPTED_EXTENSIONS } from '../../core/constants'
import {
  ActivityIcon,
  AlertIcon,
  BarChartIcon,
  DatabaseIcon,
  FileIcon,
  SearchIcon,
  ShieldCheckIcon,
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
        {/* 1. Sovereign Security & Trust Banner */}
        <div className="workspace-security-banner">
          <div className="security-banner-icon">
            <ShieldCheckIcon size={18} />
          </div>
          <div className="security-banner-content">
            <span className="security-banner-title">100% In-Memory Sandbox · Zero Server Uploads</span>
            <span className="security-banner-text">
              Your files are processed strictly inside your computer's RAM. No rows or numbers are ever transmitted, saved, or uploaded to any server.
            </span>
          </div>
          <div className="security-banner-pill">Verified Private</div>
        </div>

        {/* 2. NotebookLM-Style Studio Welcome Header */}
        <div className="workspace-welcome-head">
          <div className="workspace-welcome-mark">
            <DatabaseIcon size={20} />
          </div>
          <h1 className="workspace-welcome-title">Add sources to get started</h1>
          <p className="workspace-welcome-subtitle">
            Upload your spreadsheets, CSV, or Excel workbooks. Ask questions, explore trends, and generate executive summaries.
          </p>
        </div>

        {/* 3. Dual Source Onboarding Cards */}
        <div className="workspace-source-cards">
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
              <UploadIcon size={24} />
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

          {/* Quick-Start Demo Card */}
          <div className="source-sample-card">
            <div className="sample-card-top">
              <div className="sample-card-icon">
                <FileIcon size={20} />
              </div>
              <div className="sample-card-info">
                <span className="sample-card-title">Sample Dataset</span>
                <span className="sample-card-meta">orders.csv · 1.2M rows · 84 MB</span>
              </div>
            </div>
            <p className="sample-card-desc">
              Try Tabula immediately with a pre-configured customer orders and revenue dataset.
            </p>
            <button
              type="button"
              className="sample-load-btn"
              onClick={() => void loadSample()}
              disabled={busy || sampleLoading}
            >
              {sampleLoading ? 'Loading sample…' : 'Load Sample Dataset →'}
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
