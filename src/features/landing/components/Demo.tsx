import {
  BarChartIcon,
  CheckIcon,
  FileIcon,
  ZapIcon,
} from '../../common/Icons'
import { DEMO_SCENARIOS, type DemoScenario } from '../data'

/**
 * The interactive walkthrough.
 *
 * The tabs are real scenarios, and the preview shows exactly what the model
 * does with them — no screenshots, no mock-ups.
 */

export interface DemoProps {
  activeScenario: DemoScenario
  setActiveScenario: (scenario: DemoScenario) => void
  isAuthenticated: boolean
  onNavigateToAuth: (mode?: 'signin' | 'signup') => void
  onNavigateToApp: () => void
}

export function Demo({
  activeScenario,
  setActiveScenario,
  isAuthenticated,
  onNavigateToAuth,
  onNavigateToApp,
}: DemoProps) {
  return (
<section id="demo" className="landing-section landing-demo-section">
        <div className="landing-container">
          <div className="landing-section-header">
            <span className="landing-subhead">How It Works</span>
            <h2 className="landing-section-title">Ask In Plain English, Get Instant Insights</h2>
            <p className="landing-section-desc">
              Select an example scenario below to see how Tabula analyzes spreadsheets right in your browser.
            </p>
          </div>

          {/* Scenario Tabs */}
          <div className="landing-demo-tabs">
            {DEMO_SCENARIOS.map((sc) => (
              <button
                key={sc.id}
                type="button"
                className={`landing-demo-tab ${activeScenario.id === sc.id ? 'is-active' : ''}`}
                onClick={() => setActiveScenario(sc)}
              >
                <div className="landing-tab-title">{sc.name}</div>
                <div className="landing-tab-meta">
                  <span>{sc.rows}</span>
                  <span className="landing-tab-dot">•</span>
                  <span>{sc.fileType}</span>
                </div>
              </button>
            ))}
          </div>

          {/* Clean App Preview Window */}
          <div className="landing-sandbox-card">
            <div className="landing-window-header">
              <div className="landing-window-dots">
                <span className="dot dot-gray" />
                <span className="dot dot-gray" />
                <span className="dot dot-gray" />
              </div>
              <div className="landing-window-title">
                {activeScenario.fileType} • {activeScenario.rows}
              </div>
              <div className="landing-window-speed">
                <ZapIcon size={12} />
                <span>Processed in {activeScenario.execTime}</span>
              </div>
            </div>

            <div className="landing-sandbox-body">
              <div className="landing-sandbox-col">
                <div className="landing-prompt-box">
                  <div className="landing-prompt-badge">Your Question</div>
                  <div className="landing-prompt-text">"{activeScenario.question}"</div>
                </div>

                <div className="landing-process-box">
                  <div className="landing-process-header">
                    <FileIcon size={13} />
                    <span>Automated Local Calculation</span>
                  </div>
                  <div className="landing-process-content">
                    {activeScenario.calcStep}
                  </div>
                </div>
              </div>

              <div className="landing-sandbox-col">
                <div className="landing-result-box">
                  <div className="landing-result-header">
                    <BarChartIcon size={13} />
                    <span>Instant Visual Breakdown</span>
                  </div>
                  <div className="landing-bars-container">
                    {activeScenario.chartData.map((item, idx) => (
                      <div key={idx} className="landing-bar-row">
                        <div className="landing-bar-info">
                          <span className="landing-bar-label">{item.label}</span>
                          <span className="landing-bar-val">{item.formatted}</span>
                        </div>
                        <div className="landing-bar-track">
                          <div
                            className="landing-bar-fill"
                            style={{ width: `${item.value}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="landing-ai-synthesis">
                  <div className="landing-synthesis-header">Executive Summary</div>
                  <p className="landing-synthesis-body">{activeScenario.summary}</p>
                  <div className="landing-synthesis-footer">
                    <span className="landing-badge-green">
                      <CheckIcon size={11} /> Calculated on your device
                    </span>
                    <button
                      type="button"
                      className="landing-synthesis-cta"
                      onClick={() => (isAuthenticated ? onNavigateToApp() : onNavigateToAuth('signup'))}
                    >
                      Try with your own file →
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
  )
}
