import type { ReactNode } from 'react'
import { Inbox } from 'lucide-react'
import { cn } from '../../lib/cn'
import { Button } from './Button'

export type EmptyStateProps = {
  icon?: ReactNode
  title: string
  description?: string
  actionLabel?: string
  onAction?: () => void
  className?: string
}

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-lg border border-dashed border-line bg-gradient-to-b from-surface-muted/70 to-surface-raised px-6 py-14 text-center',
        className,
      )}
    >
      <div className="mb-4 grid size-14 place-items-center rounded-lg bg-brand-tint text-brand-primary shadow-soft">
        {icon ?? <Inbox className="size-6" aria-hidden />}
      </div>
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      {description ? <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-ink-muted">{description}</p> : null}
      {actionLabel && onAction ? (
        <Button className="mt-5" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  )
}
