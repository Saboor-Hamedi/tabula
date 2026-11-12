import {
  BarChartIcon,
  CheckIcon,
  DatabaseIcon,
  FileIcon,
  LockIcon,
  ShieldCheckIcon,
} from '../../common/Icons'
import { FEATURES, type FeatureItem } from '../data'

const ICONS: Record<FeatureItem['icon'], typeof DatabaseIcon> = {
  database: DatabaseIcon,
  file: FileIcon,
  chart: BarChartIcon,
  check: CheckIcon,
  lock: LockIcon,
  shield: ShieldCheckIcon,
}

/**
 * The feature grid.
 *
 * One bento layout, drawn from data so the grid can grow without new markup.
 */

export function Features() {
  return (
<section id="features" className="landing-section landing-features-section">
        <div className="landing-container">
          <div className="landing-section-header">
            <span className="landing-subhead">Features</span>
            <h2 className="landing-section-title">Everything You Need For Better Data Decisions</h2>
            <p className="landing-section-desc">
              Get clarity from your spreadsheets in seconds without writing complex formulas.
            </p>
          </div>

          <div className="landing-bento-grid">
            {FEATURES.map((feature) => {
              const Icon = ICONS[feature.icon]
              return (
                <div
                  className={`landing-bento-item ${feature.large ? 'bento-large' : ''}`}
                  key={feature.title}
                >
                  <div className="landing-bento-icon">
                    <Icon size={18} />
                  </div>
                  <h3 className="landing-bento-title">{feature.title}</h3>
                  <p className="landing-bento-desc">{feature.description}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>
  )
}
