import { Link, useRouter } from '../../../core/router'
import { ROUTES } from '../../../core/router/paths'
import { ArrowRightIcon, ExternalIcon, TableIcon } from '../../common/Icons'
import { READY_DATASET_FILES, RESEARCH_REPOSITORIES } from '../../sources/sourcesData'

export function ResearchSourcesSection() {
  const { navigate } = useRouter()
  const featuredRepos = RESEARCH_REPOSITORIES.slice(0, 4)

  const handleOpenSample = (fileUrl: string, fileName: string) => {
    try {
      sessionStorage.setItem('tabula:pending-sample', `${fileUrl}::${fileName}`)
      navigate(ROUTES.workspace)
    } catch {
      window.open(fileUrl, '_blank')
    }
  }

  return (
    <section id="sources" className="landing-section lp-sources-section">
      <div className="landing-container">
        <div className="landing-masthead" data-reveal>
          <div className="landing-masthead-left">
            <span className="landing-kicker">02 — Open Data Directory</span>
            <h2 className="landing-section-title">
              Free research sources,{' '}
              <span className="landing-serif-italic">ready to query.</span>
            </h2>
          </div>
          <p className="landing-masthead-desc">
            Find public datasets from Kaggle, Hugging Face, World Bank, and Our World in Data — or
            open our pre-loaded CSV workbooks directly in the workspace with one click.
          </p>
        </div>

        {/* Featured Repositories Grid */}
        <div className="lp-sources-grid">
          {featuredRepos.map((repo, idx) => (
            <article key={repo.id} className="lp-source-card" data-reveal>
              <div>
                <div className="lp-source-top-meta">
                  <span className="lp-source-num">0{idx + 1}</span>
                  <span className="lp-source-count">{repo.datasetCount}</span>
                </div>
                <h3 className="lp-source-name">{repo.name}</h3>
                <span className="lp-source-cat">{repo.categoryLabel}</span>
                <p className="lp-source-desc">{repo.description}</p>
              </div>

              <div className="lp-source-foot">
                <div className="lp-source-formats">
                  {repo.formats.slice(0, 3).map((fmt) => (
                    <span key={fmt} className="lp-source-fmt">
                      {fmt}
                    </span>
                  ))}
                </div>
                <a
                  href={repo.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="lp-source-link"
                >
                  <span>Open</span>
                  <ExternalIcon size={12} />
                </a>
              </div>
            </article>
          ))}
        </div>

        {/* Ready-to-Query CSV Folder Preview + Route to /sources */}
        <div className="lp-sources-callout" data-reveal>
          <div className="lp-callout-left">
            <div className="lp-callout-icon">
              <TableIcon size={20} />
            </div>
            <div className="lp-callout-copy">
              <h4 className="lp-callout-title">
                {READY_DATASET_FILES.length} Ready-to-Query Benchmark CSVs &amp;{' '}
                {RESEARCH_REPOSITORIES.length} Open Repositories
              </h4>
              <p className="lp-callout-desc">
                Open climate anomalies, World Bank macro indicators, or AI model benchmarks directly
                in Tabula, or browse the full directory by category.
              </p>
              <div className="lp-callout-quick-files">
                {READY_DATASET_FILES.slice(0, 3).map((file) => (
                  <button
                    key={file.id}
                    type="button"
                    className="lp-quick-file-chip"
                    onClick={() => handleOpenSample(file.fileUrl, file.fileName)}
                    title={`Load ${file.fileName} into Workspace`}
                  >
                    <TableIcon size={11} />
                    <span>{file.fileName}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <Link
            to={ROUTES.sources}
            className="landing-cta-btn landing-cta-primary"
          >
            <span>Explore All Sources</span>
            <ArrowRightIcon size={15} />
          </Link>
        </div>
      </div>
    </section>
  )
}
