/**
 * The comparison table.
 *
 * What the product does, next to what the category does.
 */

export function Comparison() {
  return (
<section id="comparison" className="landing-section landing-comparison-section">
        <div className="landing-container">
          <div className="landing-section-header">
            <span className="landing-subhead">Comparison</span>
            <h2 className="landing-section-title">Tabula vs. Cloud Software</h2>
            <p className="landing-section-desc">
              Why business professionals choose private on-device analysis.
            </p>
          </div>

          <div className="landing-table-wrap">
            <table className="landing-comparison-table">
              <thead>
                <tr>
                  <th>Feature</th>
                  <th className="highlight-col">Tabula</th>
                  <th>Standard Cloud Tools</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="feature-name">Data Storage</td>
                  <td className="highlight-col">
                    <span className="badge-positive">Never uploaded (100% on device)</span>
                  </td>
                  <td>Saved on external cloud servers</td>
                </tr>
                <tr>
                  <td className="feature-name">Speed</td>
                  <td className="highlight-col">
                    <span className="badge-positive">Instant (under 1 second)</span>
                  </td>
                  <td>Slow upload times and server queues</td>
                </tr>
                <tr>
                  <td className="feature-name">Confidentiality</td>
                  <td className="highlight-col">
                    <span className="badge-positive">100% private by design</span>
                  </td>
                  <td>Requires security audits & NDAs</td>
                </tr>
                <tr>
                  <td className="feature-name">Offline Use</td>
                  <td className="highlight-col">
                    <span className="badge-positive">Works offline anywhere</span>
                  </td>
                  <td>Does not work without internet</td>
                </tr>
                <tr>
                  <td className="feature-name">Learning Curve</td>
                  <td className="highlight-col">
                    <span className="badge-positive">Plain English questions</span>
                  </td>
                  <td>Complex formulas and training needed</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>
  )
}
