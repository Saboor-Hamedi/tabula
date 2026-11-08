import type { KeyboardEvent, PointerEvent } from 'react'

/**
 * Vertical drag handle for one of the two side panels.
 *
 * The handle sits in the 5px gutter between columns. Dragging updates the
 * column width continuously; arrow keys provide the same control from the
 * keyboard. Widths are clamped by the caller.
 */

export interface ResizeHandleProps {
  side: 'left' | 'right'
  width: number
  min: number
  max: number
  label: string
  onResize: (width: number) => void
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)))
}

export function ResizeHandle({
  side,
  width,
  min,
  max,
  label,
  onResize,
}: ResizeHandleProps) {
  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.currentTarget.focus()
    const startX = event.clientX
    const startWidth = width

    const handleMove = (moveEvent: globalThis.PointerEvent) => {
      const delta = moveEvent.clientX - startX
      const next = side === 'left' ? startWidth + delta : startWidth - delta
      onResize(clamp(next, min, max))
    }

    const handleEnd = () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleEnd)
      window.removeEventListener('pointercancel', handleEnd)
      document.body.classList.remove('is-resizing')
    }

    document.body.classList.add('is-resizing')
    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleEnd, { once: true })
    window.addEventListener('pointercancel', handleEnd, { once: true })
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    const direction = event.key === 'ArrowLeft' ? -1 : 1
    const signed = side === 'left' ? direction : -direction
    onResize(clamp(width + signed * 16, min, max))
  }

  return (
    <div
      className="resize-handle"
      role="separator"
      aria-label={label}
      aria-orientation="vertical"
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={Math.round(width)}
      tabIndex={0}
      onPointerDown={handlePointerDown}
      onKeyDown={handleKeyDown}
    />
  )
}
