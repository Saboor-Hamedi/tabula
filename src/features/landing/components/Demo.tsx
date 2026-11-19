import { useState } from 'react'
import {
  ArrowRightIcon,
  CheckIcon,
  SheetIcon,
  ZapIcon,
} from '../../common/Icons'
import { DEMO_SCENARIOS, type DemoScenario } from '../data'

/**
 * The interactive editorial showcase.
 *
 * Clean pill switcher above a crisp high-contrast studio window with
 * animated column/bar visualization, step-by-step trace, and result table.
 */

export interface DemoProps {
  activeScenario: DemoScenario
  setActiveScenario: (scenario: DemoScenario) => void
  isAuthenticated: boolean
  onNavigateToAuth: (mode?: 'signin' | 'signup') => void
  onNavigateToApp: () => void
}

type OutputView = 'chart' | 'steps' | 'table'

export function Demo({
  activeScenario,
  setActiveScenario,
  isAuthenticated,
  onNavigateToAuth,
  onNavigateToApp,
}: DemoProps) {
  const [view, setView] = useState<OutputView>('chart')

  return (
    <section id="demo" className="landing-section landing-demo-section">
      <div className="landing-container">
        <div className="landing-masthead" data-reveal>
          <div className="landing-masthead-left">
            <span className="landing-kicker">01 — Interactive Showcase</span>
            <h2 className="landing-section-title">
              Plain English in. <span className="landing-serif-italic">Clarity out.</span>
            </h2>
          </div>
          <p className="landing-masthead-desc">
            Choose a real-world spreadsheet below to explore how Lumina Tabula turns complex files
            into immediate charts, tables, and executive briefs.
          </p>
        </div>

        {/* Sleek Segmented Scenario Switcher */}
        <div className="demo-pill-nav" role="tablist" aria-label="Example spreadsheets" data-reveal>
          {DEMO_SCENARIOS.map((sc) => {
            const isActive = activeScenario.id === sc.id
            return (
              <button
                key={sc.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                className={`demo-pill-btn ${isActive ? 'is-active' : ''}`}
                onClick={() => setActiveScenario(sc)}
              >
                <span className="demo-pill-name">{sc.name}</span>
                <span className="demo-pill-rows">{sc.rows}</span>
              </button>
            )
          })}
        </div>

        {/* Editorial Studio Window */}
        <div className="demo-studio-frame" data-reveal>
          <div className="demo-studio-bar">
            <div className="demo-studio-file">
              <SheetIcon size={14} />
              <span className="demo-studio-filename">{activeScenario.fileType}</span>
              <span className="demo-studio-sep">·</span>
              <span className="demo-studio-meta">{activeScenario.rows}</span>
            </div>

            <div className="demo-studio-controls">
              <span className="demo-studio-speed">
                <ZapIcon size={12} />
                <span>{activeScenario.execTime}</span>
              </span>

              <div className="demo-view-switch" role="tablist" aria-label="Output format">
                <button
                  type="button"
                  role="tab"
                  aria-selected={view === 'chart'}
                  className={`demo-view-btn ${view === 'chart' ? 'is-active' : ''}`}
                  onClick={() => setView('chart')}
                >
                  Chart
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={view === 'steps'}
                  className={`demo-view-btn ${view === 'steps' ? 'is-active' : ''}`}
                  onClick={() => setView('steps')}
                >
                  Steps
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={view === 'table'}
                  className={`demo-view-btn ${view === 'table' ? 'is-active' : ''}`}
                  onClick={() => setView('table')}
                >
                  Table
                </button>
              </div>
            </div>
          </div>

          <div className="demo-studio-grid">
            {/* Left: Prompt + KPIs + Executive Brief */}
            <div className="demo-studio-left">
              <div className="demo-question-block">
                <span className="demo-micro-label">Question asked</span>
                <p className="demo-question-quote">“{activeScenario.question}”</p>
              </div>

              <div className="demo-kpi-strip">
                {activeScenario.kpis.map((kpi) => (
                  <div key={kpi.label} className="demo-kpi-cell">
                    <span className="demo-kpi-label">{kpi.label}</span>
                    <strong className={`demo-kpi-val tone-${kpi.tone ?? 'neutral'}`}>
                      {kpi.value}
                    </strong>
                  </div>
                ))}
              </div>

              <div className="demo-summary-block">
                <span className="demo-micro-label">Executive summary</span>
                <p className="demo-summary-text">{activeScenario.summary}</p>
              </div>

              <div className="demo-studio-foot">
                <span className="demo-local-tag">
                  <CheckIcon size={12} /> Computed privately on your device
                </span>
                <button
                  type="button"
                  className="demo-try-link"
                  onClick={() =>
                    isAuthenticated ? onNavigateToApp() : onNavigateToAuth('signup')
                  }
                >
                  <span>Try with your file</span>
                  <ArrowRightIcon size={13} />
                </button>
              </div>
            </div>

            {/* Right: Crisp Visual Canvas */}
            <div className="demo-studio-right">
              {view === 'chart' && (
                <div className="demo-chart-stage" key={activeScenario.id}>
                  <div className="demo-chart-columns">
                    {activeScenario.chartData.map((item, idx) => (
                      <div key={item.label} className="demo-col-item">
                        <span className="demo-col-val">{item.formatted}</span>
                        <div className="demo-col-track">
                          <div
                            className={`demo-col-bar ${idx === 0 ? 'is-lead' : ''}`}
                            style={{ height: `${item.value}%` }}
                          />
                        </div>
                        <span className="demo-col-label">{item.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {view === 'steps' && (
                <ol className="demo-steps-list">
                  {activeScenario.steps.map((step, i) => (
                    <li key={i}>
                      <span className="demo-step-num">0{i + 1}</span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              )}

              {view === 'table' && (
                <div className="demo-table-wrap">
                  <table className="demo-mini-table">
                    <thead>
                      <tr>
                        {activeScenario.tableColumns.map((col) => (
                          <th key={col}>{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {activeScenario.tableRows.map((row, rIdx) => (
                        <tr key={rIdx}>
                          {row.map((cell, cIdx) => (
                            <td key={cIdx}>{cell}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
