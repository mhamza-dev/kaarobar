import type { HTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

export type ProgressBarProps = HTMLAttributes<HTMLDivElement> & {
  /** 0–100. Omit or null for a brief indeterminate pulse. */
  value?: number | null
  label?: string
  tone?: 'brand' | 'warning'
}

export function ProgressBar({
  value,
  label,
  tone = 'brand',
  className,
  ...props
}: ProgressBarProps) {
  const determinate = typeof value === 'number' && Number.isFinite(value)
  const clamped = determinate ? Math.max(0, Math.min(100, value)) : 0
  const fillClass =
    tone === 'warning' ? 'bg-warning' : 'bg-brand-primary'

  return (
    <div className={cn('space-y-2', className)} {...props}>
      {label ? (
        <div className="flex items-center justify-between gap-3 text-sm">
          <p className="min-w-0 truncate font-medium text-ink">{label}</p>
          {determinate ? (
            <span className="shrink-0 tabular-nums text-ink-muted">{Math.round(clamped)}%</span>
          ) : null}
        </div>
      ) : null}
      <div
        className="h-2.5 overflow-hidden rounded-full bg-surface-muted"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={determinate ? Math.round(clamped) : undefined}
        aria-label={label}
      >
        {determinate ? (
          <div
            className={cn('h-full rounded-full transition-[width] duration-200 ease-out', fillClass)}
            style={{ width: `${clamped}%` }}
          />
        ) : (
          <div className={cn('h-full w-1/3 animate-pulse rounded-full', fillClass)} />
        )}
      </div>
    </div>
  )
}
