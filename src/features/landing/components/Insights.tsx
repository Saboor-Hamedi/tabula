import { useEffect, useState } from 'react'
import { Link } from '../../../core/router'
import { ROUTES } from '../../../core/router/paths'
import { isSupabaseConfigured } from '../../../core/supabase/client'
import { ArrowRightIcon } from '../../common/Icons'
import { Feed, listPublishedPostsPage } from '../../posts'

/**
 * The public Posts section on the front page.
 *
 * Brings the paginated list of published posts right onto the landing page so
 * visitors can browse analyses immediately. Hidden when no published posts exist.
 */

export function Insights() {
  const [hasPosts, setHasPosts] = useState<boolean | null>(
    isSupabaseConfigured ? null : false,
  )

  useEffect(() => {
    if (!isSupabaseConfigured) return
    let active = true
    void listPublishedPostsPage({ limit: 1, offset: 0 })
      .then((result) => {
        if (active) setHasPosts(result.total > 0)
      })
      .catch(() => {
        if (active) setHasPosts(false)
      })
    return () => {
      active = false
    }
  }, [])

  if (!hasPosts) {
    return null
  }

  return (
    <section id="posts" className="landing-section landing-insights">
      <div className="landing-container">
        <div className="landing-section-header">
          <span className="landing-subhead">Posts</span>
          <h2 className="landing-section-title">Published Posts From The Workspace</h2>
          <p className="landing-section-desc">
            Explore published analyses, summary tables, charts, and diagrams directly from Lumina Tabula.
          </p>
        </div>

        <Feed limit={6} paginate />

        <div className="landing-insights-cta">
          <Link className="landing-cta-btn landing-cta-secondary" to={ROUTES.posts}>
            <span>Browse all posts</span>
            <ArrowRightIcon size={13} />
          </Link>
        </div>
      </div>
    </section>
  )
}
