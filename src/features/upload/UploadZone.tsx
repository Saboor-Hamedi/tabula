import { useRef, useState, type DragEvent } from 'react'
import { ACCEPTED_EXTENSIONS } from '../../core/constants'
import { AlertIcon, DatabaseIcon, UploadIcon } from '../common/Icons'
import { useSession } from '../SessionProvider'
import { UploadStatus } from './UploadStatus'

export function UploadZone() {
  const { uploadFile, upload, dbError } = useSession()
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  const busy = upload.phase === 'reading' || upload.phase === 'ingesting'

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return
    void uploadFile(files[0])
  }

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    setDragging(false)
    if (busy) return
    handleFiles(event.dataTransfer.files)
  }

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    if (!busy) setDragging(true)
  }

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    setDragging(false)
  }

  return (
    <div className="upload-screen">
      <div className="upload-hero">
        <div className="upload-eyebrow">
          <DatabaseIcon size={14} />
          In-browser analytics · DuckDB-WASM
        </div>
        <h1 className="upload-title">Talk to your spreadsheet.</h1>
        <p className="upload-subtitle">
          Upload a CSV or Excel workbook. Tabula profiles it with DuckDB, then answers questions
          with SQL, charts, and tables. Nothing is uploaded to a server.
        </p>

        <div
          className={`upload-zone ${dragging ? 'is-dragging' : ''} ${busy ? 'is-busy' : ''}`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => {
            if (!busy) inputRef.current?.click()
          }}
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
          <div className="upload-icon" aria-hidden>
            <UploadIcon size={26} />
          </div>
          <div className="upload-zone-title">Drop a file here</div>
          <div className="upload-zone-sub">
            or <span className="upload-link">browse your computer</span>
          </div>
          <div className="upload-formats">
            {ACCEPTED_EXTENSIONS.map((extension) => (
              <span key={extension} className="format-pill">
                {extension.slice(1).toUpperCase()}
              </span>
            ))}
            <span className="format-note">Up to 80 MB · all sheets imported</span>
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

        <UploadStatus state={upload} />

        {dbError ? (
          <div className="upload-status is-error" role="alert">
            <AlertIcon size={15} />
            <div>
              <strong>DuckDB could not start</strong>
              <span>{dbError}</span>
            </div>
          </div>
        ) : null}

        <div className="upload-features">
          <div className="upload-feature">
            <strong>Private by default</strong>
            <span>Files never leave this browser tab.</span>
          </div>
          <div className="upload-feature">
            <strong>Agentic exploration</strong>
            <span>Schema-aware SQL with real data profiling.</span>
          </div>
          <div className="upload-feature">
            <strong>Charts and tables</strong>
            <span>Mermaid visualizations grounded in results.</span>
          </div>
        </div>
      </div>
    </div>
  )
}
