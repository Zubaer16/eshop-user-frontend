'use client'
import { LoaderCircle } from 'lucide-react'
import type { ButtonHTMLAttributes } from 'react'

export function PendingIndicator({ label }: { label: string }) {
  return (
    <span
      role="status"
      aria-label={label}
      className="loading-reveal inline-flex align-middle"
    >
      <LoaderCircle
        aria-hidden="true"
        size={16}
        className="animate-spin motion-reduce:animate-none"
      />
    </span>
  )
}
export function PendingButton({
  busy,
  pendingLabel,
  children,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  busy: boolean
  pendingLabel: string
}) {
  return (
    <button
      {...props}
      disabled={busy || disabled}
      aria-busy={busy || undefined}
    >
      <span className="inline-grid place-items-center align-middle">
        <span
          className={
            busy
              ? 'invisible inline-flex items-center justify-center [grid-area:1/1]'
              : 'inline-flex items-center justify-center [grid-area:1/1]'
          }
          aria-hidden={busy || undefined}
        >
          {children}
        </span>
        <span
          className={
            busy
              ? 'inline-flex items-center justify-center gap-2 [grid-area:1/1]'
              : 'invisible inline-flex items-center justify-center gap-2 [grid-area:1/1]'
          }
          aria-hidden={!busy || undefined}
        >
          <span key={String(busy)} className="loading-reveal">
            <LoaderCircle
              aria-hidden="true"
              size={16}
              className="animate-spin motion-reduce:animate-none"
            />
          </span>
          {pendingLabel}
        </span>
      </span>
    </button>
  )
}
