import { useEffect } from 'react'

interface ShortcutActions {
  exportTranscript: () => void
  toggleSidebar?: () => void
  togglePanel?: () => void
  openSettings?: () => void
}

/** Global power shortcuts that stay out of the way while typing. */
export function useKeyboardShortcuts({
  exportTranscript,
  toggleSidebar,
  togglePanel,
  openSettings,
}: ShortcutActions): void {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const modifier = event.metaKey || event.ctrlKey

      // Escape key to blur active input or close sheets
      if (event.key === 'Escape' && !modifier) {
        const active = document.activeElement
        if (active instanceof HTMLElement && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) {
          active.blur()
        }
        return
      }

      if (!modifier) return

      // Toggle right Studio / Inspector panel: Ctrl + \ or Cmd + \
      if (event.key === '\\' && togglePanel) {
        event.preventDefault()
        togglePanel()
        return
      }

      // Toggle left dataset sidebar: Ctrl + B or Cmd + B
      if (event.key.toLowerCase() === 'b' && toggleSidebar) {
        event.preventDefault()
        toggleSidebar()
        return
      }

      // Open Settings: Ctrl + , or Cmd + ,
      if (event.key === ',' && openSettings) {
        event.preventDefault()
        openSettings()
        return
      }

      // Focus composer: Ctrl + K or Cmd + K
      if (event.key.toLowerCase() === 'k') {
        const composer = document.querySelector<HTMLTextAreaElement>('.composer-textarea')
        if (!composer) return
        event.preventDefault()
        composer.focus()
        return
      }

      // Quick export transcript: Ctrl + Shift + E
      if (event.shiftKey && event.key.toLowerCase() === 'e') {
        event.preventDefault()
        exportTranscript()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [exportTranscript, toggleSidebar, togglePanel, openSettings])
}
