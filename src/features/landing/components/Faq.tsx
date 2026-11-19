import { ChevronDownIcon } from '../../common/Icons'
import { FAQS } from '../data'

/**
 * Frequently Asked Questions — Asymmetric Editorial Split.
 */

export interface FaqProps {
  openIndex: number | null
  setOpenIndex: (index: number | null) => void
}

export function Faq({ openIndex, setOpenIndex }: FaqProps) {
  return (
    <section id="faq" className="landing-section landing-faq-section">
      <div className="landing-container">
        <div className="faq-editorial-split">
          <div className="faq-sticky-head" data-reveal>
            <span className="landing-kicker">06 — Questions</span>
            <h2 className="landing-section-title">
              Common <span className="landing-serif-italic">questions.</span>
            </h2>
            <p className="faq-sticky-desc">
              Everything you should know about privacy, file formats, and working offline.
            </p>
          </div>

          <div className="faq-ledger" data-reveal data-delay="2">
            {FAQS.map((faq, idx) => {
              const isOpen = openIndex === idx
              return (
                <div key={faq.q} className={`faq-ledger-item ${isOpen ? 'is-open' : ''}`}>
                  <button
                    type="button"
                    className="faq-ledger-btn"
                    aria-expanded={isOpen}
                    onClick={() => setOpenIndex(isOpen ? null : idx)}
                  >
                    <span>{faq.q}</span>
                    <ChevronDownIcon size={17} className="faq-chevron" />
                  </button>
                  {isOpen && <div className="faq-ledger-answer">{faq.a}</div>}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}
