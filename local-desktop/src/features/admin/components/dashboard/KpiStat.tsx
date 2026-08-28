import type { ReactNode } from 'react'
import { cn } from '../../../../lib/cn'
import { StaggerItem } from '../../../../components/ui'

type Props = {
  label: string
  value: string
  meta?: string
  icon: ReactNode
  tone?: 'brand' | 'success' | 'warning' | 'danger'
  className?: string
}

const toneWell: Record<NonNullable<Props['tone']>, string> = {
  brand: 'bg-brand-tint text-brand-primary',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
}

export function KpiStat({ label, value, meta, icon, tone = 'brand', className }: Props) {
  return (
    <StaggerItem className={cn('h-full min-w-0', className)}>
      <div
        className={cn(
          'group relative flex h-full flex-col overflow-hidden rounded-lg border border-white/40 bg-surface-raised/85 p-4 shadow-soft backdrop-blur-xl transition-[box-shadow,transform] duration-pos hover:-translate-y-0.5 hover:shadow-lift sm:p-5',
        )}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -end-6 -top-6 size-24 rounded-full bg-brand-tint/40 blur-2xl transition-opacity group-hover:opacity-100"
        />
        <div className="relative flex min-h-0 flex-1 items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 flex-col self-stretch">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">{label}</p>
            <p className="mt-2 truncate text-2xl font-bold tracking-tight text-ink sm:text-[1.7rem]">{value}</p>
            {meta ? <p className="mt-auto pt-1.5 text-sm text-ink-muted">{meta}</p> : null}
          </div>
          <div className={cn('grid size-11 shrink-0 place-items-center rounded-lg shadow-soft', toneWell[tone])}>
            {icon}
          </div>
        </div>
      </div>
    </StaggerItem>
  )
}
