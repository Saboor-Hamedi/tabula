import type { ButtonHTMLAttributes, ReactNode } from 'react'

/**
 * Square icon button used across the header, sidebar and panels.
 *
 * One component keeps hit area, radius, hover and focus states identical
 * everywhere instead of each surface re-inventing them.
 */

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string
  active?: boolean
  size?: 'sm' | 'md'
  children: ReactNode
}

export function IconButton({
  label,
  active = false,
  size = 'md',
  children,
  className = '',
  ...rest
}: IconButtonProps) {
  return (
    <button
      type="button"
      className={`icon-btn icon-btn-${size} ${active ? 'is-active' : ''} ${className}`.trim()}
      aria-label={label}
      title={label}
      aria-pressed={active || undefined}
      {...rest}
    >
      {children}
    </button>
  )
}
