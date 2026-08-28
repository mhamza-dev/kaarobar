import type { HTMLAttributes, ReactNode } from 'react'
import { motion } from 'framer-motion'
import { cn } from '../../lib/cn'

export type CardProps = HTMLAttributes<HTMLDivElement> & {
  title?: ReactNode
  description?: ReactNode
  actions?: ReactNode
  /** Enable hover lift for featured cards */
  interactive?: boolean
  /** Soft accent border / wash */
  accent?: 'brand' | 'success' | 'warning' | 'danger' | 'none'
}

const accentClass: Record<NonNullable<CardProps['accent']>, string> = {
  none: '',
  brand:
    'border-brand-primary/35 bg-gradient-to-br from-brand-tint/55 via-surface-raised/75 to-surface-raised/80',
  success:
    'border-success/30 bg-gradient-to-br from-success-soft/50 via-surface-raised/75 to-surface-raised/80',
  warning:
    'border-warning/30 bg-gradient-to-br from-warning-soft/50 via-surface-raised/75 to-surface-raised/80',
  danger:
    'border-danger/30 bg-gradient-to-br from-danger-soft/45 via-surface-raised/75 to-surface-raised/80',
}

export function Card({
  className,
  title,
  description,
  actions,
  children,
  interactive = false,
  accent = 'none',
  ...props
}: CardProps) {
  const hasHeader = Boolean(title || description || actions)

  return (
    <motion.div
      className={cn(
        'relative overflow-hidden rounded-lg border border-white/40 bg-surface-raised/85 p-5 shadow-soft backdrop-blur-xl',
        'before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-brand-primary/25 before:to-transparent',
        accentClass[accent],
        className,
      )}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
      whileHover={
        interactive
          ? { y: -3, boxShadow: '0 18px 40px rgba(15, 23, 42, 0.12)' }
          : undefined
      }
    >
      <div className="relative flex h-full min-h-0 min-w-0 flex-1 flex-col" {...props}>
        {hasHeader ? (
          <div className="-mx-5 -mt-5 mb-4 flex shrink-0 items-start justify-between gap-3 border-b border-white/30 bg-surface-raised/60 px-5 py-4 backdrop-blur-md">
            <div className="min-w-0">
              {title ? <h3 className="text-base font-semibold tracking-tight text-ink">{title}</h3> : null}
              {description ? <p className="mt-1 text-sm leading-relaxed text-ink-muted">{description}</p> : null}
            </div>
            {actions ? <div className="shrink-0">{actions}</div> : null}
          </div>
        ) : null}
        {children}
      </div>
    </motion.div>
  )
}
