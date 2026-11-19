import { useRouter } from '../../core/router'
import { ROUTES, userPath } from '../../core/router/paths'
import { useAuthUser, useUserSlug } from '../auth/useProfile'
import { HeroPixelField } from '../common/HeroPixelField'
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

      <section className="sources-page-hero">
        <HeroPixelField />
        <div className="sources-page-hero-inner">
          <span className="sources-page-kicker">Open Research Directory</span>
          <h1 className="sources-page-title">Free Research Sources &amp; Open Datasets</h1>
          <p className="sources-page-subtitle">
            Browse verified open data hubs like Kaggle, Hugging Face, World Bank, and Our World in
            Data by category — or open ready-to-query CSV workbooks directly in Tabula.
          </p>
        </div>
      </section>

      <main className="sources-page-main">
        <ResearchSources hideHeroCard onLoadDatasetFile={handleLoadDatasetFile} />
      </main>

      <Footer />
    </div>
  )
}
