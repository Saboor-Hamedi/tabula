import { useMemo, useState } from 'react'
import {
  ArrowRightIcon,
  DatabaseIcon,
  DownloadIcon,
  ExternalIcon,
  FileIcon,
  GlobeIcon,
  SearchIcon,
  TableIcon,
} from '../common/Icons'
import './sources.css'
import { READY_DATASET_FILES, RESEARCH_REPOSITORIES } from './sourcesData'
import type { ReadyDatasetFile, ResearchRepository, SourceCategory } from './types'

export interface ResearchSourcesProps {
  onLoadDatasetFile?: (file: ReadyDatasetFile) => Promise<void> | void
  /** When true, hides the inner hero card (e.g., when rendered inside the public /sources page which has its own masthead). */
  hideHeroCard?: boolean
}

const FOLDER_CATEGORIES: { id: SourceCategory; label: string }[] = [
  { id: 'all', label: 'All Sources' },
  { id: 'files', label: 'Ready CSV Files' },
  { id: 'ml', label: 'Machine Learning & AI' },
  { id: 'economics', label: 'Economics & Markets' },
  { id: 'climate', label: 'Climate & Science' },
  { id: 'academic', label: 'Academic Research' },
  { id: 'government', label: 'Public & Government' },
]

function buildRepoSearchUrl(repo: ResearchRepository, query: string): string {
  const q = encodeURIComponent(query)
  if (repo.id === 'kaggle') return `https://www.kaggle.com/datasets?search=${q}`
  if (repo.id === 'huggingface') return `https://huggingface.co/datasets?search=${q}`
  if (repo.id === 'google-dataset-search')
    return `https://datasetsearch.research.google.com/search?query=${q}`
  if (repo.id === 'zenodo') return `https://zenodo.org/search?q=${q}`
  if (repo.id === 'data-gov') return `https://catalog.data.gov/dataset?q=${q}`
  return repo.url
}

export function ResearchSources({
  onLoadDatasetFile,
  hideHeroCard = false,
}: ResearchSourcesProps) {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<SourceCategory>('all')
  const [loadingId, setLoadingId] = useState<string | null>(null)

  const term = search.trim().toLowerCase()

  const filteredRepos = useMemo(() => {
    if (category === 'files') return []
    return RESEARCH_REPOSITORIES.filter((repo) => {
      const matchesCat = category === 'all' || repo.category === category
      if (!matchesCat) return false
      if (!term) return true
      return (
        repo.name.toLowerCase().includes(term) ||
        repo.description.toLowerCase().includes(term) ||
        repo.categoryLabel.toLowerCase().includes(term) ||
        repo.tags.some((t) => t.toLowerCase().includes(term)) ||
        repo.popularSearches.some((s) => s.toLowerCase().includes(term))
      )
    })
  }, [category, term])

  const filteredFiles = useMemo(() => {
    return READY_DATASET_FILES.filter((file) => {
      const matchesCat =
        category === 'all' || category === 'files' || file.category === category
      if (!matchesCat) return false
      if (!term) return true
      return (
        file.name.toLowerCase().includes(term) ||
        file.description.toLowerCase().includes(term) ||
        file.fileName.toLowerCase().includes(term) ||
        file.columns.some((c) => c.toLowerCase().includes(term))
      )
    })
  }, [category, term])

  const folderCounts = useMemo(() => {
    const counts: Record<SourceCategory, number> = {
      all: RESEARCH_REPOSITORIES.length + READY_DATASET_FILES.length,
      files: READY_DATASET_FILES.length,
      ml: 0,
      economics: 0,
      climate: 0,
      health: 0,
      academic: 0,
      government: 0,
    }
    for (const r of RESEARCH_REPOSITORIES) {
      counts[r.category] = (counts[r.category] ?? 0) + 1
    }
    for (const f of READY_DATASET_FILES) {
      counts[f.category] = (counts[f.category] ?? 0) + 1
    }
    return counts
  }, [])

  const handleLoadFile = async (file: ReadyDatasetFile) => {
    setLoadingId(file.id)
    try {
      if (onLoadDatasetFile) {
        await onLoadDatasetFile(file)
      } else {
        window.open(file.fileUrl, '_blank')
      }
    } finally {
      setLoadingId(null)
    }
  }

  return (
    <div className="sources-hub" aria-label="Research Sources & Datasets">
      {!hideHeroCard ? (
        <section className="sources-hero-card">
          <div className="sources-hero-top">
            <span className="sources-badge">
              <GlobeIcon size={12} />
              <span>Open Data Directory</span>
            </span>
            <span className="source-file-format">
              {RESEARCH_REPOSITORIES.length} Repositories · {READY_DATASET_FILES.length} CSV Files
            </span>
          </div>

          <h2 className="sources-hero-title">Free Research Sources &amp; Open Datasets</h2>
          <p className="sources-hero-desc">
            Browse public datasets from Kaggle, Hugging Face, World Bank, and Our World in Data, or
            load ready-to-query CSV files directly into Tabula's DuckDB workspace.
          </p>
        </section>
      ) : null}

      {/* Explorer Layout: Left Folders + Right Content */}
      <div className="sources-explorer-layout">
        {/* Left Folder Sidebar */}
        <aside className="sources-folder-rail" aria-label="Source folders">
          <div className="sources-folder-rail-head">Directories</div>
          <div className="sources-folder-list" role="tablist">
            {FOLDER_CATEGORIES.map((folder) => {
              const active = category === folder.id
              return (
                <button
                  key={folder.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  className={`sources-folder-btn ${active ? 'is-active' : ''}`}
                  onClick={() => setCategory(folder.id)}
                >
                  <span className="sources-folder-btn-left">
                    {folder.id === 'files' ? (
                      <FileIcon size={13} />
                    ) : (
                      <DatabaseIcon size={13} />
                    )}
                    <span>{folder.label}</span>
                  </span>
                  <span className="sources-folder-count">{folderCounts[folder.id] ?? 0}</span>
                </button>
              )
            })}
          </div>
        </aside>

        {/* Right Main Explorer */}
        <div className="sources-explorer-main">
          {/* Search Bar */}
          <div className="sources-toolbar">
            <div className="sources-search-box">
              <SearchIcon size={14} />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter by repository, topic, or CSV column (e.g. Kaggle, GDP, CO2, MMLU)…"
                aria-label="Search research sources"
              />
            </div>
            <span className="sources-results-summary">
              {filteredFiles.length} files · {filteredRepos.length} repositories
            </span>
          </div>

          {/* Section 1: Ready-to-Analyze CSV Files */}
          {filteredFiles.length > 0 ? (
            <section className="sources-section">
              <div className="sources-section-head">
                <div>
                  <h3 className="sources-section-title">
                    Ready-to-Query CSV Workbooks ({filteredFiles.length})
                  </h3>
                  <p className="sources-section-sub">
                    Local benchmark files bundled with Tabula — click to open directly in the SQL &amp;
                    AI workspace.
                  </p>
                </div>
              </div>

              <div className="sources-files-stack">
                {filteredFiles.map((file) => (
                  <div key={file.id} className="source-file-row">
                    <div className="source-file-left">
                      <div className="source-file-icon">
                        <TableIcon size={18} />
                      </div>
                      <div className="source-file-info">
                        <div className="source-file-name">
                          <span>{file.name}</span>
                          <span className="source-file-format">{file.fileName}</span>
                        </div>
                        <p className="source-file-desc">{file.description}</p>
                        <div className="source-file-cols">
                          {file.columns.map((col) => (
                            <span key={col} className="source-col-chip">
                              {col}
                            </span>
                          ))}
                        </div>
                        <div className="source-file-meta-line">
                          <span>{file.rowCount}</span>
                          <span>·</span>
                          <span>{file.columnsCount} columns</span>
                          <span>·</span>
                          <span>{file.fileSize}</span>
                          <span>·</span>
                          <span>{file.categoryLabel}</span>
                        </div>
                      </div>
                    </div>

                    <div className="source-file-actions">
                      <a
                        href={file.fileUrl}
                        download={file.fileName}
                        className="source-download-btn"
                        title={`Download ${file.fileName}`}
                        aria-label={`Download ${file.fileName}`}
                      >
                        <DownloadIcon size={13} />
                      </a>

                      <button
                        type="button"
                        className="source-load-btn"
                        disabled={loadingId === file.id}
                        onClick={() => void handleLoadFile(file)}
                      >
                        <span>
                          {loadingId === file.id ? 'Opening…' : 'Open in Workspace'}
                        </span>
                        <ArrowRightIcon size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {/* Section 2: Open Research Repositories */}
          {category !== 'files' ? (
            <section className="sources-section">
              <div className="sources-section-head">
                <div>
                  <h3 className="sources-section-title">
                    Open Data Repositories ({filteredRepos.length})
                  </h3>
                  <p className="sources-section-sub">
                    Download CSV, Parquet, or JSON datasets from verified research catalogs and drop
                    them into Tabula.
                  </p>
                </div>
              </div>

              {filteredRepos.length === 0 ? (
                <div className="sources-empty-state">
                  <p>No sources match “{search}”.</p>
                  <button
                    type="button"
                    className="source-visit-btn"
                    onClick={() => {
                      setSearch('')
                      setCategory('all')
                    }}
                  >
                    Reset filters
                  </button>
                </div>
              ) : (
                <div className="sources-grid">
                  {filteredRepos.map((repo) => (
                    <article key={repo.id} className="source-repo-card">
                      <div>
                        <div className="source-repo-head">
                          <div className="source-repo-info">
                            <h4 className="source-repo-name">{repo.name}</h4>
                            <span className="source-repo-category">{repo.categoryLabel}</span>
                          </div>
                          <span className="source-repo-count-pill">{repo.datasetCount}</span>
                        </div>

                        <p className="source-repo-desc">{repo.description}</p>
                      </div>

                      <div className="source-repo-meta">
                        {repo.popularSearches.length > 0 ? (
                          <div className="source-popular-row">
                            <span className="source-popular-label">Quick search:</span>
                            <div className="source-repo-tags">
                              {repo.popularSearches.map((topic) => (
                                <a
                                  key={topic}
                                  href={buildRepoSearchUrl(repo, topic)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="source-search-chip"
                                  title={`Search "${topic}" on ${repo.name}`}
                                >
                                  {topic} ↗
                                </a>
                              ))}
                            </div>
                          </div>
                        ) : null}

                        <div className="source-repo-footer">
                          <div className="source-format-list">
                            {repo.formats.map((fmt) => (
                              <span key={fmt} className="source-fmt-badge">
                                {fmt}
                              </span>
                            ))}
                          </div>
                          <a
                            href={repo.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="source-visit-btn"
                          >
                            <span>Visit Source</span>
                            <ExternalIcon size={11} />
                          </a>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          ) : null}
        </div>
      </div>
    </div>
  )
}
