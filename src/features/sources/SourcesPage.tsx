import { useRouter } from '../../core/router'
import { ROUTES, userPath } from '../../core/router/paths'
import { useAuthUser, useUserSlug } from '../auth/useProfile'
import { HeroPixelField } from '../common/HeroPixelField'
import { DatabaseIcon, GlobeIcon, ShieldCheckIcon } from '../common/Icons'
import { Header } from '../header/Header'
import { Footer } from '../landing/components/Footer'
import { ResearchSources } from './ResearchSources'
import type { ReadyDatasetFile } from './types'

/**
 * Public `/sources` routed page.
 *
 * Allows anyone to browse free open research repositories (Kaggle, Hugging Face,
 * World Bank, Our World in Data, Zenodo, Data.gov) by folder/category and
 * open ready-to-query CSV files directly in the workspace.
 */
export function SourcesPage() {
  const { navigate } = useRouter()
  const user = useAuthUser()
  const userSlug = useUserSlug()
  const isSignedIn = Boolean(user && !user.is_anonymous)

  const handleLoadDatasetFile = (file: ReadyDatasetFile) => {
    try {
      sessionStorage.setItem('tabula:pending-sample', `${file.fileUrl}::${file.fileName}`)
      navigate(isSignedIn ? userPath('/workspace', userSlug) : ROUTES.workspace)
    } catch {
      window.open(file.fileUrl, '_blank')
    }
  }

  return (
    <div className="sources-page-shell">
      <Header variant="page" />

      <section className="subpage-hero">
        <div className="hero-ledger-grid" aria-hidden="true" />
        <HeroPixelField />
        <div className="subpage-hero-inner">
          <span className="subpage-hero-kicker">
            <GlobeIcon size={12} />
            <span>Open Research Directory</span>
          </span>
          <h1 className="subpage-hero-title">
            Verified datasets,{' '}
            <span className="landing-hero-serif">ready to query.</span>
          </h1>
          <p className="subpage-hero-subtitle">
            Browse curated open-data hubs like Kaggle, Hugging Face, World Bank, and Our World in
            Data — or load ready-to-query CSV workbooks straight into Tabula.
          </p>
          <div className="subpage-hero-meta">
            <span className="subpage-hero-pill">
              <GlobeIcon size={13} />
              <span>6 Curated Repositories</span>
            </span>
            <span className="subpage-hero-pill">
              <DatabaseIcon size={13} />
              <span>Instant CSV Workbooks</span>
            </span>
            <span className="subpage-hero-pill">
              <ShieldCheckIcon size={13} />
              <span>100% Local Processing</span>
            </span>
          </div>
        </div>
      </section>

      <main className="sources-page-main">
        <ResearchSources hideHeroCard onLoadDatasetFile={handleLoadDatasetFile} />
      </main>

      <Footer />
    </div>
  )
}
