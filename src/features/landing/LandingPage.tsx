import { useState } from 'react'
import {
  ArrowRightIcon,
  BarChartIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  DatabaseIcon,
  FileIcon,
  LockIcon,
  MoonIcon,
  ShieldCheckIcon,
  SunIcon,
  ZapIcon,
} from '../common/Icons'
import { useTheme } from '../common/useTheme'

interface LandingPageProps {
  onNavigateToAuth: (mode?: 'signin' | 'signup') => void
  onNavigateToApp: () => void
  isAuthenticated: boolean
  userEmail?: string
}

interface DemoScenario {
  id: string
  name: string
  rows: string
  fileType: string
  question: string
  calcStep: string
  execTime: string
  summary: string
  chartData: { label: string; value: number; formatted: string }[]
}

const DEMO_SCENARIOS: DemoScenario[] = [
  {
    id: 'customers',
    name: 'Customer Retention & Churn',
    rows: '1,248,500 rows',
    fileType: 'Customer_Activity.xlsx',
    question: 'Show me accounts paying over $5,000 whose usage dropped by more than 35% this month',
    calcStep:
      'Filtering accounts with revenue >= $5,000 and activity decline > 35% across all customer cohorts...',
    execTime: '0.04s',
    summary:
      'Found 14 high-value accounts at immediate risk representing $142,800 in revenue. Most are concentrated in Q3 due to recent software updates.',
    chartData: [
      { label: 'Q3 Accounts', value: 85, formatted: '$64,200 at risk' },
      { label: 'Q2 Accounts', value: 52, formatted: '$38,500 at risk' },
      { label: 'Q4 Accounts', value: 34, formatted: '$24,100 at risk' },
      { label: 'Q1 Accounts', value: 22, formatted: '$16,000 at risk' },
    ],
  },
  {
    id: 'healthcare',
    name: 'Medical Research Trials',
    rows: '684,200 rows',
    fileType: 'Patient_Outcomes.csv',
    question: 'Compare patient recovery rates between Treatment Group A, Group B, and Control',
    calcStep:
      'Calculating average recovery scores, standard deviations, and completion rates by group at Day 28...',
    execTime: '0.02s',
    summary:
      'Treatment Group B showed a 4.8x higher improvement rate compared to the control group with 94.2% positive response.',
    chartData: [
      { label: 'Treatment B', value: 92, formatted: '94.2% Positive' },
      { label: 'Treatment A', value: 65, formatted: '68.5% Positive' },
      { label: 'Standard Care', value: 38, formatted: '41.0% Positive' },
      { label: 'Control Group', value: 15, formatted: '18.2% Positive' },
    ],
  },
  {
    id: 'finance',
    name: 'Quarterly Sales & Expenses',
    rows: '4,520,000 rows',
    fileType: 'Annual_Transactions.csv',
    question: 'Which product categories generated the highest profit margins after accounting for shipping delays?',
    calcStep:
      'Aggregating net margin across 4.5 million line items grouped by product category and fulfillment speed...',
    execTime: '0.06s',
    summary:
      'Enterprise Hardware delivered 42.6% net margin despite shipping delays. Consumer Accessories suffered the highest margin erosion.',
    chartData: [
      { label: 'Enterprise Hardware', value: 94, formatted: '42.6% Margin' },
      { label: 'Cloud Services', value: 71, formatted: '34.8% Margin' },
      { label: 'Office Supplies', value: 45, formatted: '22.1% Margin' },
      { label: 'Consumer Goods', value: 28, formatted: '14.4% Margin' },
    ],
  },
]

const FAQS = [
  {
    q: 'How does Tabula analyze my files without uploading them?',
    a: 'Tabula performs all calculations directly inside your web browser. When you open a file, your computer does all the work locally. Your files are never transmitted across the internet, never saved to any database, and never stored on any server.',
  },
  {
    q: 'Can anyone see, save, or steal my confidential business data?',
    a: 'No. We have zero access to your data. Everything runs privately on your device. Only table column headers are read to understand your questions, while all confidential numbers and customer records stay exclusively on your computer.',
  },
  {
    q: 'What types of files can I analyze?',
    a: 'You can open Excel spreadsheets (.xlsx), CSV files, TSV files, and large data files with millions of rows. Simply drag and drop your file into Tabula and begin immediately.',
  },
  {
    q: 'Do I need to install software or know complicated formulas?',
    a: 'No. Tabula works immediately in your standard web browser (Chrome, Safari, Edge, Firefox). You do not need to install plugins or write complex formulas. Just type questions in plain English.',
  },
  {
    q: 'Can I work offline without an internet connection?',
    a: 'Yes. Because data processing happens entirely on your machine, you can open and analyze your spreadsheets even when offline or on an airplane.',
  },
  {
    q: 'How do I share my reports and findings with colleagues?',
    a: 'You can export clean PDF summary reports, high-resolution charts, and filtered spreadsheets with a single click to share with executives and team members.',
  },
]

export function LandingPage({
  onNavigateToAuth,
  onNavigateToApp,
  isAuthenticated,
}: LandingPageProps) {
  const { theme, toggleTheme } = useTheme()
  const [activeScenario, setActiveScenario] = useState<DemoScenario>(DEMO_SCENARIOS[0])
  const [isAnnual, setIsAnnual] = useState(true)
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0)

  const scrollTo = (id: string) => {
    const el = document.getElementById(id)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' })
    }
  }

  return (
    <div className="landing-page">
      {/* 1. Sticky Fixed Header with Privacy Notice */}
      <header className="landing-nav">
        {/* Top Trust & Privacy Banner */}
        <div className="landing-privacy-strip">
          <div className="landing-container landing-privacy-strip-inner">
            <span className="privacy-pill-icon">
              <ShieldCheckIcon size={13} />
            </span>
            <span className="privacy-strip-text">
              <strong>100% Private:</strong> Your files never leave your computer. Nothing is ever saved, uploaded, or tracked.
            </span>
          </div>
        </div>

        {/* Main Navigation Bar */}
        <div className="landing-nav-inner">
          <div className="landing-brand" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <div className="landing-logo-badge">
              <DatabaseIcon size={15} />
            </div>
            <div className="landing-brand-text">
              <span className="landing-brand-name">Tabula</span>
            </div>
          </div>

          <nav className="landing-links">
            <button type="button" onClick={() => scrollTo('demo')} className="landing-link">
              Interactive Demo
            </button>
            <button type="button" onClick={() => scrollTo('privacy')} className="landing-link">
              Privacy Guarantee
            </button>
            <button type="button" onClick={() => scrollTo('features')} className="landing-link">
              Features
            </button>
            <button type="button" onClick={() => scrollTo('comparison')} className="landing-link">
              Comparison
            </button>
            <button type="button" onClick={() => scrollTo('pricing')} className="landing-link">
              Pricing
            </button>
            <button type="button" onClick={() => scrollTo('faq')} className="landing-link">
              FAQ
            </button>
          </nav>

          <div className="landing-nav-actions">
            <button
              type="button"
              className="landing-theme-btn"
              onClick={(e) => toggleTheme(e)}
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            >
              {theme === 'dark' ? <SunIcon size={14} /> : <MoonIcon size={14} />}
            </button>

            {isAuthenticated ? (
              <button
                type="button"
                className="landing-btn landing-btn-primary"
                onClick={onNavigateToApp}
              >
                <span>Open Workspace</span>
                <ArrowRightIcon size={13} />
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className="landing-btn landing-btn-ghost"
                  onClick={() => onNavigateToAuth('signin')}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  className="landing-btn landing-btn-primary"
                  onClick={() => onNavigateToAuth('signup')}
                >
                  <span>Get Started Free</span>
                  <ArrowRightIcon size={13} />
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* 2. Sober, Robust Hero Section */}
      <section className="landing-hero">
        <div className="landing-container">
          <h1 className="landing-hero-title">
            Instant spreadsheet answers. <br />
            Zero files uploaded or saved.
          </h1>

          <p className="landing-hero-subtitle">
            Open your Excel and CSV files without uploading them to any cloud. Ask questions in
            plain English to get automated charts, business trends, and executive summaries
            in seconds.
          </p>

          <div className="landing-hero-cta-group">
            {isAuthenticated ? (
              <button
                type="button"
                className="landing-cta-btn landing-cta-primary"
                onClick={onNavigateToApp}
              >
                <span>Open Workspace</span>
                <ArrowRightIcon size={14} />
              </button>
            ) : (
              <button
                type="button"
                className="landing-cta-btn landing-cta-primary"
                onClick={() => onNavigateToAuth('signup')}
              >
                <span>Start Analyzing Free</span>
                <ArrowRightIcon size={14} />
              </button>
            )}

            <button
              type="button"
              className="landing-cta-btn landing-cta-secondary"
              onClick={() => scrollTo('demo')}
            >
              <span>See Live Demo</span>
              <ChevronDownIcon size={13} />
            </button>
          </div>

          {/* Understated Trust Metrics */}
          <div className="landing-metrics-ribbon">
            <div className="landing-metric-item">
              <span className="landing-metric-val">100%</span>
              <span className="landing-metric-label">Runs On Your Device</span>
            </div>
            <div className="landing-metric-divider" />
            <div className="landing-metric-item">
              <span className="landing-metric-val">0 Bytes</span>
              <span className="landing-metric-label">Uploaded To Servers</span>
            </div>
            <div className="landing-metric-divider" />
            <div className="landing-metric-item">
              <span className="landing-metric-val">Instant</span>
              <span className="landing-metric-label">No Waiting Or Queue</span>
            </div>
            <div className="landing-metric-divider" />
            <div className="landing-metric-item">
              <span className="landing-metric-val">Safe</span>
              <span className="landing-metric-label">Confidential & Compliant</span>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Interactive Live Demo */}
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

      {/* 4. Privacy Guarantee Section */}
      <section id="privacy" className="landing-section landing-architecture-section">
        <div className="landing-container">
          <div className="landing-section-header">
            <span className="landing-subhead">Privacy Guarantee</span>
            <h2 className="landing-section-title">Your Data Stays With You. Period.</h2>
            <p className="landing-section-desc">
              We engineered Tabula so that it is physically impossible for us to save, access, or lose your data.
            </p>
          </div>

          <div className="landing-architecture-grid">
            <div className="landing-arch-card arch-legacy">
              <div className="landing-arch-badge badge-warning">Standard Cloud Tools</div>
              <h3 className="landing-arch-title">How Traditional Software Works</h3>
              <ul className="landing-arch-list">
                <li>
                  <span className="arch-cross">✕</span> Your confidential spreadsheets are uploaded over the internet
                </li>
                <li>
                  <span className="arch-cross">✕</span> Data is stored on third-party servers and cloud disks
                </li>
                <li>
                  <span className="arch-cross">✕</span> Risk of data breaches, accidental leaks, and employee access
                </li>
                <li>
                  <span className="arch-cross">✕</span> Requires complex legal agreements and security sign-offs
                </li>
              </ul>
            </div>

            <div className="landing-arch-card arch-tabula">
              <div className="landing-arch-badge badge-success">
                <ShieldCheckIcon size={13} /> The Tabula Guarantee
              </div>
              <h3 className="landing-arch-title">Total Local Privacy</h3>
              <ul className="landing-arch-list">
                <li>
                  <span className="arch-check">✓</span> <strong>0 bytes uploaded:</strong> Files open strictly inside your browser
                </li>
                <li>
                  <span className="arch-check">✓</span> <strong>Never saved:</strong> When you close the tab, data vanishes from memory
                </li>
                <li>
                  <span className="arch-check">✓</span> <strong>Never stolen:</strong> No server has access to your rows or numbers
                </li>
                <li>
                  <span className="arch-check">✓</span> <strong>Full compliance:</strong> Safe for financial and medical records
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* 5. Clean Features Grid (No technical terms) */}
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
            <div className="landing-bento-item bento-large">
              <div className="landing-bento-icon">
                <DatabaseIcon size={18} />
              </div>
              <h3 className="landing-bento-title">Handles Millions of Rows Instantly</h3>
              <p className="landing-bento-desc">
                Open massive spreadsheets that crash standard spreadsheet software. Filter, group,
                and summarize millions of records in milliseconds with zero lag or freezing.
              </p>
            </div>

            <div className="landing-bento-item">
              <div className="landing-bento-icon">
                <FileIcon size={18} />
              </div>
              <h3 className="landing-bento-title">Drag & Drop Any Spreadsheet</h3>
              <p className="landing-bento-desc">
                Simply drop in your Excel (.xlsx) and CSV files. Dates, amounts, and categories are
                automatically recognized so you can start analyzing immediately.
              </p>
            </div>

            <div className="landing-bento-item">
              <div className="landing-bento-icon">
                <BarChartIcon size={18} />
              </div>
              <h3 className="landing-bento-title">Automatic Charts & Graphs</h3>
              <p className="landing-bento-desc">
                View distributions, monthly trends, and comparisons instantly. Charts are created
                automatically based on what you ask.
              </p>
            </div>

            <div className="landing-bento-item">
              <div className="landing-bento-icon">
                <CheckIcon size={18} />
              </div>
              <h3 className="landing-bento-title">Executive Summary Reports</h3>
              <p className="landing-bento-desc">
                Turn hours of manual spreadsheet work into a clean, presentation-ready summary
                you can export to PDF and email to your team.
              </p>
            </div>

            <div className="landing-bento-item">
              <div className="landing-bento-icon">
                <LockIcon size={18} />
              </div>
              <h3 className="landing-bento-title">Works Completely Offline</h3>
              <p className="landing-bento-desc">
                Analyze your sensitive business files anywhere—even on an airplane with no internet
                connection. Everything happens right on your laptop.
              </p>
            </div>

            <div className="landing-bento-item">
              <div className="landing-bento-icon">
                <ShieldCheckIcon size={18} />
              </div>
              <h3 className="landing-bento-title">Zero Tracking Or Data Retention</h3>
              <p className="landing-bento-desc">
                We never store your spreadsheets, record your numbers, or track your queries.
                Your business confidential numbers stay yours.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 6. Comparison Table */}
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

      {/* 7. Pricing Section: ONLY MONTHLY (No Lifetime Card, No Technical Terms) */}
      <section id="pricing" className="landing-section landing-pricing-section">
        <div className="landing-container">
          <div className="landing-section-header">
            <span className="landing-subhead">Simple Pricing</span>
            <h2 className="landing-section-title">Affordable Monthly Plans</h2>
            <p className="landing-section-desc">
              No hidden fees, no complicated tiers, and no per-query charges.
            </p>

            {/* Monthly / Annual Toggle */}
            <div className="landing-billing-toggle">
              <span className={!isAnnual ? 'is-active' : ''}>Monthly</span>
              <button
                type="button"
                className={`toggle-switch ${isAnnual ? 'checked' : ''}`}
                onClick={() => setIsAnnual(!isAnnual)}
                aria-label="Toggle annual discount"
              >
                <div className="toggle-slider" />
              </button>
              <span className={isAnnual ? 'is-active' : ''}>
                Annual <span className="discount-pill">Save 20%</span>
              </span>
            </div>
          </div>

          <div className="landing-pricing-grid-two">
            {/* Free Starter */}
            <div className="landing-pricing-card">
              <div className="card-top">
                <h3 className="plan-name">Free Starter</h3>
                <p className="plan-desc">For individuals exploring their spreadsheets.</p>
                <div className="plan-price">
                  <span className="price-amount">$0</span>
                  <span className="price-period">/ month</span>
                </div>
              </div>
              <ul className="plan-features">
                <li>
                  <CheckIcon size={14} /> Up to 100,000 rows per spreadsheet
                </li>
                <li>
                  <CheckIcon size={14} /> Instant calculations & summary tables
                </li>
                <li>
                  <CheckIcon size={14} /> Interactive charts & visual graphs
                </li>
                <li>
                  <CheckIcon size={14} /> 100% private — files never leave your computer
                </li>
                <li>
                  <CheckIcon size={14} /> Works completely offline
                </li>
              </ul>
              <button
                type="button"
                className="plan-cta-btn btn-outline"
                onClick={() => (isAuthenticated ? onNavigateToApp() : onNavigateToAuth('signup'))}
              >
                {isAuthenticated ? 'Open Workspace' : 'Get Started Free'}
              </button>
            </div>

            {/* Pro Analyst */}
            <div className="landing-pricing-card card-featured">
              <div className="featured-pill">Most Popular</div>
              <div className="card-top">
                <h3 className="plan-name">Pro Analyst</h3>
                <p className="plan-desc">For professionals, managers, and consultants.</p>
                <div className="plan-price">
                  <span className="price-amount">{isAnnual ? '$15' : '$19'}</span>
                  <span className="price-period">/ month</span>
                </div>
                {isAnnual && <div className="billing-subtext">Billed annually ($180/year)</div>}
              </div>
              <ul className="plan-features">
                <li>
                  <CheckIcon size={14} /> <strong>All Free features included</strong>
                </li>
                <li>
                  <CheckIcon size={14} /> Unlimited rows & massive spreadsheet files
                </li>
                <li>
                  <CheckIcon size={14} /> Automated executive summaries & insights
                </li>
                <li>
                  <CheckIcon size={14} /> Presentation-ready PDF report downloads
                </li>
                <li>
                  <CheckIcon size={14} /> Connect and compare multiple files together
                </li>
                <li>
                  <CheckIcon size={14} /> Priority customer support
                </li>
              </ul>
              <button
                type="button"
                className="plan-cta-btn btn-primary"
                onClick={() => (isAuthenticated ? onNavigateToApp() : onNavigateToAuth('signup'))}
              >
                {isAuthenticated ? 'Open Workspace' : 'Start Free Trial'}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 8. FAQ Accordion */}
      <section id="faq" className="landing-section landing-faq-section">
        <div className="landing-container">
          <div className="landing-section-header">
            <span className="landing-subhead">Questions & Answers</span>
            <h2 className="landing-section-title">Frequently Asked Questions</h2>
          </div>

          <div className="landing-faq-accordion">
            {FAQS.map((faq, idx) => {
              const isOpen = openFaqIndex === idx
              return (
                <div key={idx} className={`faq-item ${isOpen ? 'is-open' : ''}`}>
                  <button
                    type="button"
                    className="faq-question-btn"
                    onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                  >
                    <span>{faq.q}</span>
                    {isOpen ? <ChevronUpIcon size={15} /> : <ChevronDownIcon size={15} />}
                  </button>
                  {isOpen && <div className="faq-answer-content">{faq.a}</div>}
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* 9. Final Call to Action */}
      <section className="landing-final-cta">
        <div className="landing-container">
          <div className="landing-cta-inner">
            <h2 className="landing-cta-title">
              Ready to analyze your data with total privacy?
            </h2>
            <p className="landing-cta-desc">
              No credit card required. Drop in your spreadsheet and start asking questions immediately.
            </p>
            <div className="landing-cta-buttons">
              <button
                type="button"
                className="landing-cta-btn landing-cta-primary"
                onClick={() => (isAuthenticated ? onNavigateToApp() : onNavigateToAuth('signup'))}
              >
                <span>{isAuthenticated ? 'Open Workspace' : 'Get Started Free'}</span>
                <ArrowRightIcon size={14} />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 10. Clean Footer */}
      <footer className="landing-footer">
        <div className="landing-container">
          <div className="landing-footer-top">
            <div className="landing-footer-brand">
              <div className="landing-brand">
                <div className="landing-logo-badge">
                  <DatabaseIcon size={14} />
                </div>
                <span className="landing-brand-name">Tabula</span>
              </div>
              <p className="landing-footer-tagline">
                The private data analysis tool where files never leave your computer.
              </p>
            </div>

            <div className="landing-footer-cols">
              <div className="footer-col">
                <div className="col-title">Navigation</div>
                <button type="button" onClick={() => scrollTo('demo')} className="footer-link">
                  Demo
                </button>
                <button type="button" onClick={() => scrollTo('privacy')} className="footer-link">
                  Privacy
                </button>
                <button type="button" onClick={() => scrollTo('pricing')} className="footer-link">
                  Pricing
                </button>
                <button type="button" onClick={() => scrollTo('faq')} className="footer-link">
                  FAQ
                </button>
              </div>

              <div className="footer-col">
                <div className="col-title">Privacy Promise</div>
                <span className="footer-static-item">100% On-Device</span>
                <span className="footer-static-item">Zero Cloud Storage</span>
                <span className="footer-static-item">No Telemetry</span>
                <span className="footer-static-item">Never Saved</span>
              </div>
            </div>
          </div>

          <div className="landing-footer-bottom">
            <div className="footer-copy">
              © {new Date().getFullYear()} Tabula. Your data stays with you.
            </div>
            <div className="footer-bottom-actions">
              <button
                type="button"
                className="landing-theme-btn"
                onClick={(e) => toggleTheme(e)}
                title="Toggle Dark/Light Mode"
              >
                {theme === 'dark' ? <SunIcon size={13} /> : <MoonIcon size={13} />}
                <span style={{ fontSize: '11px' }}>{theme === 'dark' ? 'Dark' : 'Light'}</span>
              </button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
