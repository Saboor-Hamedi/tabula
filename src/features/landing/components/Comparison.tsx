import { CheckIcon } from '../../common/Icons'

/**
 * Side-by-side comparison ledger.
 */

const COMPARISON_ROWS = [
  {
    feature: 'Data Storage',
    tabula: 'Never uploaded — 100% on your device',
    cloud: 'Uploaded to external cloud servers',
  },
  {
    feature: 'Speed',
    tabula: 'Instant answers in under a second',
    cloud: 'Slow uploads & server queues',
  },
  {
    feature: 'Confidentiality',
    tabula: 'Private by architecture',
    cloud: 'Requires vendor NDAs & security audits',
  },
  {
    feature: 'Offline Use',
    tabula: 'Works offline anywhere',
    cloud: 'Unavailable without internet',
  },
  {
    feature: 'Transparency',
    tabula: 'Clear, verifiable steps',
    cloud: 'Opaque black-box results',
  },
  {
    feature: 'Learning Curve',
    tabula: 'Ask in plain English',
    cloud: 'Complex formulas & training',
  },
]

export function Comparison() {
  return (
    <section id="comparison" className="landing-section landing-comparison-section">
      <div className="landing-container">
        <div className="landing-masthead" data-reveal>
          <div className="landing-masthead-left">
            <span className="landing-kicker">04 — Side by Side</span>
            <h2 className="landing-section-title">
              Why teams switch from <span className="landing-serif-italic">cloud tools.</span>
            </h2>
          </div>
          <p className="landing-masthead-desc">
            A direct look at how on-device analysis compares with traditional cloud spreadsheet
            software.
          </p>
        </div>

        <div className="swiss-table-wrap" data-reveal>
          <table className="swiss-comparison-table">
            <thead>
              <tr>
                <th>Dimension</th>
                <th className="is-tabula">Lumina Tabula</th>
                <th>Standard Cloud Tools</th>
              </tr>
            </thead>
            <tbody>
              {COMPARISON_ROWS.map((row) => (
                <tr key={row.feature}>
                  <td className="swiss-col-dim">{row.feature}</td>
                  <td className="is-tabula">
                    <span className="swiss-positive">
                      <CheckIcon size={14} />
                      <span>{row.tabula}</span>
                    </span>
                  </td>
                  <td className="swiss-col-cloud">{row.cloud}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
