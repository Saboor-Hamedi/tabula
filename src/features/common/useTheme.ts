import { useCallback, useEffect, useState } from 'react'

export type ThemeMode = 'light' | 'dark'

export const THEME_STORAGE_KEY = 'tabula-theme'

export function getInitialTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'light'
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY)
    if (saved === 'light' || saved === 'dark') return saved
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark'
  } catch {
    // fallback
  }
  return 'light'
}

// Module-level persistent theme state so remounts, HMR, and errors never lose the theme
let globalTheme: ThemeMode = getInitialTheme()
const subscribers = new Set<(theme: ThemeMode) => void>()

// Synchronously sync document attribute immediately on module load
if (typeof document !== 'undefined') {
  document.documentElement.setAttribute('data-theme', globalTheme)
}

function setGlobalTheme(next: ThemeMode) {
  globalTheme = next
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', next)
  }
  try {
    localStorage.setItem(THEME_STORAGE_KEY, next)
  } catch {
    // ignore
  }
  subscribers.forEach((fn) => fn(next))
}

// Listen to storage changes across tabs
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === THEME_STORAGE_KEY && (e.newValue === 'light' || e.newValue === 'dark')) {
      setGlobalTheme(e.newValue)
    }
  })
}

export function useTheme() {
  const [theme, setThemeState] = useState<ThemeMode>(() => globalTheme)

  useEffect(() => {
    setThemeState(globalTheme)
    const subscriber = (t: ThemeMode) => setThemeState(t)
    subscribers.add(subscriber)
    return () => {
      subscribers.delete(subscriber)
    }
  }, [])

  const toggleTheme = useCallback(
    (event?: React.MouseEvent) => {
      const nextTheme = globalTheme === 'dark' ? 'light' : 'dark'

      // If View Transition API is unavailable, toggle state directly
      const doc = document as Document & {
        startViewTransition?: (callback: () => void) => {
          ready: Promise<void>
        }
      }

      if (!doc.startViewTransition || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        setGlobalTheme(nextTheme)
        return
      }

      const x = event?.clientX ?? window.innerWidth - 60
      const y = event?.clientY ?? 26
      const endRadius = Math.hypot(
        Math.max(x, window.innerWidth - x),
        Math.max(y, window.innerHeight - y),
      )

      const transition = doc.startViewTransition(() => {
        setGlobalTheme(nextTheme)
      })

      transition.ready.then(() => {
        document.documentElement.animate(
          {
            clipPath: [
              `circle(0px at ${x}px ${y}px)`,
              `circle(${endRadius}px at ${x}px ${y}px)`,
            ],
          },
          {
            duration: 450,
            easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
            pseudoElement: '::view-transition-new(root)',
          },
        )
      })
    },
    [],
  )

  return { theme, toggleTheme }
}
