import { LockIcon } from '../../common/Icons'

/**
 * The privacy architecture.
 *
 * Editorial split: a monumental zero-upload statement on the left paired with
 * a crisp ruled comparison ledger on the right.
 */

const GUARANTEES = [
  {
    num: '01',
    title: 'Zero bytes uploaded',
    desc: 'Your Excel and CSV files open directly in browser memory. Nothing is sent to external servers.',
  },
  {
    num: '02',
    title: 'Vanishes when you close the tab',
    desc: 'We never keep copies, backups, or hidden logs of your confidential business figures.',
  },
  {
    num: '03',
    title: 'Built for sensitive teams',
    desc: 'Safe for finance, legal, HR, and clinical spreadsheets without lengthy IT security reviews.',
  },
  {
    num: '04',
    title: 'Works offline anywhere',
    desc: 'Review millions of rows on a flight or behind a corporate firewall with zero lag.',
  },
]

export function Privacy() {
  return (
    <section id="privacy" className="landing-section landing-privacy-section">
      <div className="landing-container">
        <div className="privacy-editorial-split">
          {/* Left: Monumental Statement */}
          <div className="privacy-statement" data-reveal>
            <span className="landing-kicker">02 — Privacy by Design</span>
            <h2 className="privacy-big-title">
              0 bytes uploaded.
              <span className="landing-serif-italic"> Ever.</span>
            </h2>
            <p className="privacy-lead">
              Standard cloud tools upload your entire workbook to someone else’s server. Lumina
              Tabula flips the model — bringing the entire workspace directly onto your computer.
            </p>

            <div className="privacy-flow-strip" aria-label="Data stays on your computer">
              <span className="privacy-flow-node">Your File</span>
              <span className="privacy-flow-line" aria-hidden="true" />
              <span className="privacy-flow-node is-accent">Your Browser</span>
              <span className="privacy-flow-seal">
                <LockIcon size={12} /> Stays Local
              </span>
            </div>
          </div>

          {/* Right: Hairline Architectural Ledger */}
          <div className="privacy-ledger" data-reveal data-delay="2">
            {GUARANTEES.map((item) => (
              <div key={item.num} className="privacy-ledger-row">
                <span className="privacy-ledger-num">{item.num}</span>
                <div className="privacy-ledger-copy">
                  <h3>{item.title}</h3>
                  <p>{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
