import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { FadeIn } from '../ui/motion'

type Props = {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  eyebrow?: ReactNode
  className?: string
}

export function PageHeader({ title, description, actions, eyebrow, className }: Props) {
  return (
    <FadeIn className={cn('mb-7 flex flex-wrap items-start justify-between gap-4', className)}>
      <div className="min-w-0 max-w-2xl">
        {eyebrow ? (
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-brand-primary">
            {eyebrow}
          </p>
        ) : null}
        <h2 className="text-2xl font-bold tracking-tight text-ink sm:text-[1.65rem]">{title}</h2>
        {description ? <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </FadeIn>
  )
}
