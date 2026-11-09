import { useEffect, useRef, useState } from 'react'

/** Registers the offline shell and exposes a waiting-update action. */
export function useServiceWorkerUpdate() {
  const [updateReady, setUpdateReady] = useState(false)
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null)

  useEffect(() => {
    if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return

    let active = true
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        if (!active) return
        registrationRef.current = registration
        if (registration.waiting) setUpdateReady(true)
        registration.addEventListener('updatefound', () => {
          const worker = registration.installing
          worker?.addEventListener('statechange', () => {
            if (worker.state === 'installed' && navigator.serviceWorker.controller) {
              setUpdateReady(true)
            }
          })
        })
      })
      .catch(() => undefined)

    return () => {
      active = false
    }
  }, [])

  const applyUpdate = () => {
    const waiting = registrationRef.current?.waiting
    if (waiting) {
      waiting.postMessage({ type: 'SKIP_WAITING' })
      window.setTimeout(() => window.location.reload(), 500)
    } else {
      window.location.reload()
    }
  }

  return { updateReady, applyUpdate }
}
