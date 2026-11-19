import { useEffect, useState } from 'react'
import { Link } from '../../../core/router'
import { ROUTES } from '../../../core/router/paths'
import { isSupabaseConfigured } from '../../../core/supabase/client'
import { ArrowRightIcon } from '../../common/Icons'
import { Feed, listPublishedPostsPage } from '../../posts'

/**
 * Published Stories on the front page.
 *
 * Editorial masthead above the magazine post grid. Hidden when no published posts exist.
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
        <div className="landing-masthead" data-reveal>
          <div className="landing-masthead-left">
            <span className="landing-kicker">Published</span>
            <h2 className="landing-section-title">
              From the <span className="landing-serif-italic">Workspace.</span>
            </h2>
          </div>
          <Link className="landing-masthead-link" to={ROUTES.posts}>
            <span>Explore all stories</span>
            <ArrowRightIcon size={14} />
          </Link>
        </div>

        <Feed limit={6} paginate />
      </div>
    </section>
  )
}
