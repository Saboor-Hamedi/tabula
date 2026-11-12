import { ChevronDownIcon } from '../../common/Icons'
import { FAQS } from '../data'

/**
 * The questions.
 *
 * An accordion with one open panel at a time.
 */

export interface FaqProps {
  openIndex: number | null
  setOpenIndex: (index: number | null) => void
}

export function Faq({ openIndex, setOpenIndex }: FaqProps) {
  return (
<section id="faq" className="landing-section landing-faq-section">
        <div className="landing-container">
          <div className="landing-section-header">
            <span className="landing-subhead">Questions & Answers</span>
            <h2 className="landing-section-title">Frequently Asked Questions</h2>
          </div>

          <div className="landing-faq-accordion">
            {FAQS.map((faq, idx) => {
              const isOpen = openIndex === idx
              return (
                <div key={idx} className={`faq-item ${isOpen ? 'is-open' : ''}`}>
                  <button
                    type="button"
                    className="faq-question-btn"
                    aria-expanded={isOpen}
                    onClick={() => setOpenIndex(isOpen ? null : idx)}
                  >
                    <span>{faq.q}</span>
                    <ChevronDownIcon size={15} className="faq-chevron" />
                  </button>
                  {isOpen && <div className="faq-answer-content">{faq.a}</div>}
                </div>
              )
            })}
          </div>
        </div>
      </section>
  )
}
