import { FEATURES } from '../data'

/**
 * Capabilities — Swiss-architectural numbered grid.
 *
 * Crisp hairline borders, generous breathing room, and subtle hover sweep.
 */

export function Features() {
  return (
    <section id="features" className="landing-section landing-features-section">
      <div className="landing-container">
        <div className="landing-masthead" data-reveal>
          <div className="landing-masthead-left">
            <span className="landing-kicker">03 — Capabilities</span>
            <h2 className="landing-section-title">
              Built for <span className="landing-serif-italic">real work.</span>
            </h2>
          </div>
          <p className="landing-masthead-desc">
            Fast enough for multi-million-row workbooks, simple enough for anyone on your team to
            open and use in seconds.
          </p>
        </div>

        <div className="swiss-feature-grid">
          {FEATURES.map((feature, idx) => (
            <article
              key={feature.id}
              className="swiss-feature-cell"
              data-reveal
              data-delay={String((idx % 3) + 1)}
            >
              <div className="swiss-feature-head">
                <span className="swiss-feature-num">0{idx + 1}</span>
                <span className="swiss-feature-tag">{feature.eyebrow}</span>
              </div>
              <h3 className="swiss-feature-title">{feature.title}</h3>
              <p className="swiss-feature-desc">{feature.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
