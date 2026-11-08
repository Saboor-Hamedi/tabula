import { useEffect, useRef, useState } from 'react'

/**
 * Starts expensive work only when a block approaches the viewport.
 * Falls back to immediately visible when IntersectionObserver is missing.
 */
export function useInView<T extends Element>(rootMargin = '400px') {
  const ref = useRef<T | null>(null)
  const [inView, setInView] = useState(
    () => typeof IntersectionObserver === 'undefined',
  )

  useEffect(() => {
    if (inView) return
    const element = ref.current
    if (!element) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setInView(true)
          observer.disconnect()
        }
      },
      { rootMargin },
    )

    observer.observe(element)
    return () => observer.disconnect()
  }, [inView, rootMargin])

  return { ref, inView }
}
