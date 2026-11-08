import { useEffect, useRef, useState, type MouseEvent } from 'react'
import { TrashIcon } from '../common/Icons'
import { useSession } from '../SessionProvider'

export interface DeleteSessionButtonProps {
  sessionId: string
  variant?: 'icon' | 'label'
  className?: string
}

export function DeleteSessionButton({
  sessionId,
  variant = 'icon',
  className = '',
}: DeleteSessionButtonProps) {
  const { deleteSession } = useSession()
  const [confirming, setConfirming] = useState(false)
  const timerRef = useRef<number | null>(null)

  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    },
    [],
  )

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation()
    event.preventDefault()

    if (confirming) {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current)
      setConfirming(false)
      void deleteSession(sessionId)
      return
    }

    setConfirming(true)
    timerRef.current = window.setTimeout(() => setConfirming(false), 3000)
  }

  return (
    <button
      type="button"
      className={`delete-btn ${confirming ? 'is-confirming' : ''} ${
        variant === 'label' ? 'is-labeled' : ''
      } ${className}`}
      onClick={handleClick}
      title={confirming ? 'Click again to delete this session' : 'Delete session'}
      aria-label={confirming ? 'Confirm delete session' : 'Delete session'}
    >
      <TrashIcon size={14} />
      {variant === 'label' ? <span>{confirming ? 'Confirm delete' : 'Delete'}</span> : null}
      {confirming && variant === 'icon' ? <span className="delete-confirm-text">Confirm</span> : null}
    </button>
  )
}
