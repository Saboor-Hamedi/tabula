import { useCallback, useEffect, useState } from 'react'

export type ThemeMode = 'light' | 'dark'

const THEME_STORAGE_KEY = 'tabula-theme'

function getInitialTheme(): ThemeMode {
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

export function useTheme() {
  const [theme, setThemeState] = useState<ThemeMode>(getInitialTheme)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme)
    } catch {
      // ignore
    }
  }, [theme])

  const toggleTheme = useCallback(
    (event?: React.MouseEvent) => {
      const nextTheme = theme === 'dark' ? 'light' : 'dark'

      // If View Transition API is unavailable, toggle state directly
      const doc = document as Document & {
        startViewTransition?: (callback: () => void) => {
          ready: Promise<void>
        }
      }

      if (!doc.startViewTransition || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        setThemeState(nextTheme)
        return
      }

      const x = event?.clientX ?? window.innerWidth - 60
      const y = event?.clientY ?? 26
      const endRadius = Math.hypot(
        Math.max(x, window.innerWidth - x),
        Math.max(y, window.innerHeight - y),
      )

      const transition = doc.startViewTransition(() => {
        setThemeState(nextTheme)
        document.documentElement.setAttribute('data-theme', nextTheme)
        try {
          localStorage.setItem(THEME_STORAGE_KEY, nextTheme)
        } catch {
          // ignore
        }
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
    [theme],
  )

  return { theme, toggleTheme }
}
