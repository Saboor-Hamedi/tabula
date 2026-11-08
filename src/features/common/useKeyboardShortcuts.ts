import { useEffect } from 'react'

interface ShortcutActions {
  exportTranscript: () => void
}

/** Global shortcuts that stay out of the way while typing. */
export function useKeyboardShortcuts({ exportTranscript }: ShortcutActions): void {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const modifier = event.metaKey || event.ctrlKey
      if (!modifier) return

      if (event.key.toLowerCase() === 'k') {
        const composer = document.querySelector<HTMLTextAreaElement>('.composer-textarea')
        if (!composer) return
        event.preventDefault()
        composer.focus()
        return
      }

      if (event.shiftKey && event.key.toLowerCase() === 'e') {
        event.preventDefault()
        exportTranscript()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [exportTranscript])
}
