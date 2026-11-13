import { useEffect, useState } from 'react'
import { ArrowUpIcon } from './Icons'

/**
 * Floating bottom-right button that fades in on scroll and smoothly returns
 * the user to the top of the page.
 */
export function BackTop({ threshold = 280 }: { threshold?: number }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > threshold)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [threshold])

  return (
    <button
      type="button"
      className={`back-to-top-btn${visible ? ' is-visible' : ''}`}
      aria-label="Back to top"
      title="Back to top"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
    >
      <ArrowUpIcon size={16} />
    </button>
  )
}
