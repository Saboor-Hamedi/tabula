import { useEffect, useState } from 'react'
import {
  CheckIcon,
  CloseIcon,
  CodeIcon,
  CopyIcon,
  DownloadIcon,
  ExternalIcon,
  PlayIcon,
  SheetIcon,
  TrashIcon,
} from '../common/Icons'
import { IconButton } from '../common/IconButton'
import { FigureLightbox } from '../common/FigureLightbox'
import { useSessionActions, useSessionState } from '../SessionProvider'
import { exportToJupyterNotebook } from '../../core/python'
import { buildCsv, downloadCsv } from '../../core/export/csv'
import { CodeHighlight } from '../render/CodeHighlight'
import { parseCsvToGrid } from '../spreadsheet/utils'

const QUICK_STARTERS = [
  {
    label: 'Overview (df.info())',
    code: `# Inspect dataset summary\nimport io\nbuf = io.StringIO()\ndf.info(buf=buf)\nprint(buf.getvalue())\nprint("\\nShape:", df.shape)`,
  },
  {
    label: 'Summary stats (df.describe())',
    code: `# Calculate key statistics for numerical columns\nprint(df.describe())`,
  },
  {
    label: 'Missing values check',
    code: `# Check null count and percentage per column\nmissing = df.isnull().sum()\npct = (missing / len(df) * 100).round(1)\nsummary = pd.DataFrame({'Missing Count': missing, 'Percent (%)': pct})\nprint(summary[summary['Missing Count'] > 0] if (missing > 0).any() else "No missing values found!")`,
  },
  {
    label: 'Histogram distributions',
    code: `# Plot distribution of numeric columns\nnumeric_cols = df.select_dtypes(include=['number']).columns[:4]\nif len(numeric_cols) > 0:\n    df[numeric_cols].hist(bins=20, figsize=(10, 6), edgecolor='black', grid=False)\n    plt.suptitle('Column Distributions', fontsize=14)\n    plt.tight_layout()\nelse:\n    print("No numeric columns found to plot.")`,
  },
  {
    label: 'Correlation heatmap',
    code: `# Correlation matrix between numeric features\nnumeric = df.select_dtypes(include=['number'])\nif numeric.shape[1] > 1:\n    corr = numeric.corr()\n    fig, ax = plt.subplots(figsize=(8, 6))\n    cax = ax.matshow(corr, cmap='coolwarm', vmin=-1, vmax=1)\n    fig.colorbar(cax)\n    ax.set_xticks(range(len(corr.columns)))\n    ax.set_yticks(range(len(corr.columns)))\n    ax.set_xticklabels(corr.columns, rotation=45, ha='left')\n    ax.set_yticklabels(corr.columns)\n    plt.title('Feature Correlations', pad=20)\n    plt.tight_layout()\nelse:\n    print("Need at least 2 numeric columns for correlation.")`,
  },
]

export function PythonPanel() {
  const { pythonResult, pythonHistory = [], pythonStatus, activeSession } = useSessionState()
  const { runPythonCode, clearPythonResult, removePythonRun, openSpreadsheet } = useSessionActions()
  const [selectedRunIndex, setSelectedRunIndex] = useState(0)
  const [copiedStdout, setCopiedStdout] = useState(false)
  const [copiedCode, setCopiedCode] = useState(false)
  const [showCode, setShowCode] = useState(false)
  const [copiedImgIdx, setCopiedImgIdx] = useState<number | null>(null)
  const [gridCols, setGridCols] = useState<1 | 2>(1)
  const [lightboxImg, setLightboxImg] = useState<{ url: string; index: number } | null>(null)

  // Use selected run from history, or fallback to current pythonResult
  const activeRun = pythonHistory[selectedRunIndex] || pythonResult

  // Lightbox escape key
  useEffect(() => {
    if (!lightboxImg) return
    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxImg(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [lightboxImg])

  const handleCopy = async (text: string, setCopied: (v: boolean) => void) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      // Ignore clipboard error
    }
  }

  const handleCopyImage = async (dataUrl: string, index: number) => {
    try {
      const res = await fetch(dataUrl)
      const blob = await res.blob()
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob }),
      ])
      setCopiedImgIdx(index)
      window.setTimeout(() => setCopiedImgIdx(null), 1600)
    } catch {
      // Fallback
    }
  }

  const handleDownloadImage = (dataUrl: string, index: number) => {
    const anchor = document.createElement('a')
    anchor.href = dataUrl
    anchor.download = `${activeSession?.fileName || 'analysis'}-figure-${index + 1}.png`
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
  }

  const handleExportNotebook = () => {
    const runsToExport = pythonHistory.length > 0 ? pythonHistory : activeRun ? [activeRun] : []
    if (runsToExport.length === 0) return
    exportToJupyterNotebook({
      fileName: activeSession?.fileName || 'tabula-analysis',
      runs: runsToExport,
    })
  }

  const handleDownloadDataFrame = () => {
    if (!activeRun?.dfCsv && !activeRun?.dfPreview) return
    const csvContent =
      activeRun.dfCsv ||
      (activeRun.dfPreview
        ? buildCsv(activeRun.dfPreview.columns, activeRun.dfPreview.rows)
        : '')
    if (!csvContent) return
    const baseName = activeSession?.fileName
      ? activeSession.fileName.replace(/\.[^.]+$/, '')
      : 'tabula-data'
    downloadCsv(`${baseName}-transformed.csv`, csvContent)
  }

  const handleOpenInExcel = () => {
    if (!activeRun?.dfCsv && !activeRun?.dfPreview) return
    const baseName = activeSession?.fileName
      ? activeSession.fileName.replace(/\.[^.]+$/, '')
      : 'tabula-data'
    if (activeRun.dfCsv) {
      const parsed = parseCsvToGrid(activeRun.dfCsv)
      if (parsed.headers.length > 0) {
        openSpreadsheet({
          kind: 'static',
          title: `${baseName} (Transformed)`,
          sheets: [{ name: 'Transformed Data', headers: parsed.headers, rows: parsed.rows }],
        })
        return
      }
    }
    if (activeRun.dfPreview) {
      openSpreadsheet({
        kind: 'static',
        title: `${baseName} (Preview)`,
        sheets: [
          {
            name: 'Preview',
            headers: activeRun.dfPreview.columns,
            rows: activeRun.dfPreview.rows,
          },
        ],
      })
    }
  }

  return (
    <div className="python-panel">
      {/* Top Banner / Status */}
      <div className="python-panel-header">
        <div className="python-status-group">
          <span
            className={`python-status-indicator is-${pythonStatus}`}
            aria-hidden
          />
          <span className="python-status-text">
            {pythonStatus === 'running'
              ? 'Executing code…'
              : pythonStatus === 'loading'
                ? 'Warming up Python runtime…'
                : pythonStatus === 'error'
                  ? 'Encountered error'
                  : activeRun
                    ? `Executed in ${activeRun.elapsedMs}ms`
                    : 'Python Results'}
          </span>

          {/* Active DataFrame dimensions pill */}
          {activeRun?.dfInfo ? (
            <span
              className="python-df-info-pill"
              title={`Dataset in memory: ${activeRun.dfInfo.shape[0]} rows, ${activeRun.dfInfo.shape[1]} columns (${activeRun.dfInfo.columns.join(', ')})`}
            >
              {activeRun.dfInfo.shape[0]} × {activeRun.dfInfo.shape[1]}
            </span>
          ) : null}
        </div>

        {pythonHistory.length > 0 || pythonResult ? (
          <div className="python-header-actions">
            {/* Open Transformed Dataset in Excel View */}
            {activeRun?.dfCsv || activeRun?.dfPreview ? (
              <button
                type="button"
                className="code-tool-btn"
                onClick={handleOpenInExcel}
                title="Open transformed dataset in Excel-style view"
              >
                <SheetIcon size={11} />
                <span>Open Excel</span>
              </button>
            ) : null}

            {/* Download Transformed CSV if df in memory */}
            {activeRun?.dfCsv || activeRun?.dfPreview ? (
              <button
                type="button"
                className="code-tool-btn"
                onClick={handleDownloadDataFrame}
                title="Download transformed dataset as CSV"
              >
                <DownloadIcon size={11} />
                <span>Dataset (.csv)</span>
              </button>
            ) : null}

            {/* Export Jupyter Notebook */}
            <button
              type="button"
              className="code-tool-btn"
              onClick={handleExportNotebook}
              title="Download analysis as a Jupyter Notebook (.ipynb)"
            >
              <DownloadIcon size={11} />
              <span>Notebook (.ipynb)</span>
            </button>

            <IconButton
              label="Clear all outputs"
              size="sm"
              onClick={clearPythonResult}
            >
              <TrashIcon size={13} />
            </IconButton>
          </div>
        ) : null}
      </div>

      {/* History Navigation Bar (when runs exist) */}
      {pythonHistory.length > 0 ? (
        <div className="python-history-bar" role="tablist">
          <span className="python-history-label">Runs:</span>
          <div className="python-history-pills">
            {pythonHistory.map((run, idx) => (
              <div
                key={run.executedAt || idx}
                role="tab"
                tabIndex={0}
                aria-selected={selectedRunIndex === idx}
                className={`python-history-pill ${selectedRunIndex === idx ? 'is-active' : ''}`}
                onClick={() => setSelectedRunIndex(idx)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    setSelectedRunIndex(idx)
                  }
                }}
              >
                <span>Run {pythonHistory.length - idx}</span>
                {Array.isArray(run?.images) && run.images.length > 0 ? (
                  <span className="python-pill-badge">{run.images.length}</span>
                ) : null}
                {run?.error ? <span className="python-pill-error">!</span> : null}
                <button
                  type="button"
                  className="python-pill-close-btn"
                  aria-label={`Close Run ${pythonHistory.length - idx}`}
                  title="Close run"
                  onClick={(e) => {
                    e.stopPropagation()
                    removePythonRun(idx)
                    if (selectedRunIndex >= idx && selectedRunIndex > 0) {
                      setSelectedRunIndex(selectedRunIndex - 1)
                    }
                  }}
                >
                  <CloseIcon size={10} />
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="python-panel-content">
        {/* If no runs and not running, show minimal clean empty state */}
        {!activeRun && pythonStatus !== 'running' ? (
          <div className="python-empty-state">
            <div className="python-starters-head">
              <span>Quick Starters</span>
            </div>

            <div className="python-starters-list">
              {QUICK_STARTERS.map((starter) => (
                <button
                  key={starter.label}
                  type="button"
                  className="python-starter-btn"
                  onClick={() => {
                    setSelectedRunIndex(0)
                    void runPythonCode(starter.code, { openPanel: true })
                  }}
                  disabled={!activeSession}
                >
                  <PlayIcon size={12} />
                  <span>{starter.label}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="python-results-view">
            {/* Visual Plots */}
            {activeRun && Array.isArray(activeRun.images) && activeRun.images.length > 0 ? (
              <div className="python-section python-plots-section">
                <div className="python-section-title">
                  <span>Visual Plots ({activeRun.images.length})</span>

                  {/* 1-col vs 2-col layout toggle for multi-plot sets */}
                  {activeRun.images.length >= 2 ? (
                    <div className="python-grid-toggle">
                      <button
                        type="button"
                        className={`code-tool-btn ${gridCols === 1 ? 'is-active-btn' : ''}`}
                        onClick={() => setGridCols(1)}
                        title="1 Column (Full Width)"
                      >
                        1 Col
                      </button>
                      <button
                        type="button"
                        className={`code-tool-btn ${gridCols === 2 ? 'is-active-btn' : ''}`}
                        onClick={() => setGridCols(2)}
                        title="2 Columns (Side by Side)"
                      >
                        2 Cols
                      </button>
                    </div>
                  ) : null}
                </div>

                <div className={`python-plots-list ${gridCols === 2 ? 'is-grid-2' : ''}`}>
                  {activeRun.images.map((dataUrl, index) => (
                    <div key={index} className="python-plot-card">
                      <div className="python-plot-actions">
                        <span className="python-plot-num">Figure {index + 1}</span>

                        <div className="python-plot-action-btns">
                          {/* Copy Image Button */}
                          <button
                            type="button"
                            className="tool-btn"
                            onClick={() => handleCopyImage(dataUrl, index)}
                            title="Copy image to clipboard"
                          >
                            {copiedImgIdx === index ? <CheckIcon size={11} /> : <CopyIcon size={11} />}
                            <span>{copiedImgIdx === index ? 'Copied' : 'Copy'}</span>
                          </button>

                          {/* Zoom Lightbox Button */}
                          <button
                            type="button"
                            className="tool-btn"
                            onClick={() => setLightboxImg({ url: dataUrl, index })}
                            title="Zoom figure in full-screen modal"
                          >
                            <ExternalIcon size={11} />
                            <span>Zoom</span>
                          </button>

                          {/* Download PNG Button */}
                          <button
                            type="button"
                            className="tool-btn"
                            onClick={() => handleDownloadImage(dataUrl, index)}
                            title="Download high-resolution PNG"
                          >
                            <DownloadIcon size={11} />
                            <span>Download</span>
                          </button>
                        </div>
                      </div>

                      <img
                        src={dataUrl}
                        alt={`Python Generated Plot ${index + 1}`}
                        className="python-plot-image"
                        onClick={() => setLightboxImg({ url: dataUrl, index })}
                        style={{ cursor: 'zoom-in' }}
                        loading="lazy"
                      />
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {/* DataFrame Output Table & Download */}
            {activeRun &&
            activeRun.dfPreview &&
            Array.isArray(activeRun.dfPreview.columns) &&
            activeRun.dfPreview.columns.length > 0 ? (
              <div className="python-section python-table-section">
                <div className="python-section-title">
                  <span>
                    Dataset ({(activeRun.dfPreview.totalRows ?? 0).toLocaleString()} rows ×{' '}
                    {activeRun.dfPreview.totalCols ?? activeRun.dfPreview.columns.length} cols)
                  </span>
                  <div className="python-plot-action-btns">
                    <button
                      type="button"
                      className="tool-btn"
                      onClick={handleOpenInExcel}
                      title="Open full transformed dataset in Excel view (sort, filter, head/tail, .xlsx)"
                    >
                      <SheetIcon size={11} />
                      <span>Open in Excel</span>
                    </button>
                    <button
                      type="button"
                      className="tool-btn"
                      onClick={handleDownloadDataFrame}
                      title="Download full transformed dataset as CSV"
                    >
                      <DownloadIcon size={11} />
                      <span>Download CSV</span>
                    </button>
                  </div>
                </div>

                <div className="data-table-block">
                  <div className="data-table-scroll" style={{ maxHeight: '300px' }}>
                    <table className="data-table">
                      <thead>
                        <tr>
                          {activeRun.dfPreview.columns.map((col, idx) => (
                            <th key={idx} scope="col">
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {Array.isArray(activeRun.dfPreview.rows)
                          ? activeRun.dfPreview.rows.map((row, rIdx) => (
                              <tr key={rIdx}>
                                {activeRun.dfPreview!.columns.map((_col, cIdx) => (
                                  <td key={cIdx}>
                                    {row[cIdx] !== undefined && row[cIdx] !== null && row[cIdx] !== ''
                                      ? row[cIdx]
                                      : '—'}
                                  </td>
                                ))}
                              </tr>
                            ))
                          : null}
                      </tbody>
                    </table>
                  </div>

                  <div className="data-table-foot">
                    <span>
                      {(activeRun.dfPreview.totalRows ?? 0) >
                      (Array.isArray(activeRun.dfPreview.rows) ? activeRun.dfPreview.rows.length : 0)
                        ? `Showing first ${
                            Array.isArray(activeRun.dfPreview.rows) ? activeRun.dfPreview.rows.length : 0
                          } of ${(activeRun.dfPreview.totalRows ?? 0).toLocaleString()} rows`
                        : `${
                            Array.isArray(activeRun.dfPreview.rows) ? activeRun.dfPreview.rows.length : 0
                          } row${
                            (Array.isArray(activeRun.dfPreview.rows) ? activeRun.dfPreview.rows.length : 0) === 1
                              ? ''
                              : 's'
                          }`}
                    </span>
                    <div className="data-table-foot-actions">
                      <button
                        type="button"
                        className="tool-btn"
                        onClick={handleOpenInExcel}
                        title="Open transformed dataset in Excel view"
                      >
                        <SheetIcon size={13} />
                        <span>Open in Excel</span>
                      </button>
                      <button
                        type="button"
                        className="tool-btn"
                        onClick={handleDownloadDataFrame}
                        title="Download transformed dataset as CSV"
                      >
                        <DownloadIcon size={13} />
                        <span>Download CSV</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {/* Terminal Stdout Output */}
            {activeRun && activeRun.stdout ? (
              <div className="python-section python-output-section">
                <div className="python-section-title">
                  <span>Console Output</span>
                  <button
                    type="button"
                    className="tool-btn"
                    onClick={() => handleCopy(activeRun.stdout, setCopiedStdout)}
                  >
                    {copiedStdout ? <CheckIcon size={11} /> : <CopyIcon size={11} />}
                    <span>{copiedStdout ? 'Copied' : 'Copy output'}</span>
                  </button>
                </div>
                <pre className="python-terminal">{activeRun.stdout}</pre>
              </div>
            ) : null}

            {/* Error Display */}
            {activeRun && activeRun.error ? (
              <div className="python-section python-error-section">
                <div className="python-section-title text-error">
                  <span>Execution Error</span>
                </div>
                <pre className="python-terminal is-error">{activeRun.error}</pre>
              </div>
            ) : null}

            {/* Executed Python Code */}
            {activeRun && activeRun.code ? (
              <div className="python-section python-code-section">
                <div className="python-section-title">
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <CodeIcon size={12} />
                    <span>Executed Code</span>
                  </span>
                  <div className="python-plot-action-btns">
                    <button
                      type="button"
                      className="tool-btn"
                      onClick={() => setShowCode((v) => !v)}
                    >
                      <span>{showCode ? 'Hide' : 'Show'}</span>
                    </button>
                    <button
                      type="button"
                      className="tool-btn"
                      onClick={() => handleCopy(activeRun.code, setCopiedCode)}
                    >
                      {copiedCode ? <CheckIcon size={11} /> : <CopyIcon size={11} />}
                      <span>{copiedCode ? 'Copied' : 'Copy code'}</span>
                    </button>
                  </div>
                </div>
                {showCode ? (
                  <pre className="python-terminal python-code-preview">
                    <CodeHighlight code={activeRun.code} language="python" />
                  </pre>
                ) : null}
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* Lightbox Fullscreen Modal */}
      <FigureLightbox
        src={lightboxImg?.url ?? null}
        title={lightboxImg ? `Figure ${lightboxImg.index + 1}` : ''}
        alt={lightboxImg ? `Figure ${lightboxImg.index + 1}` : undefined}
        onDownload={
          lightboxImg
            ? () => handleDownloadImage(lightboxImg.url, lightboxImg.index)
            : undefined
        }
        onClose={() => setLightboxImg(null)}
      />
    </div>
  )
}
