import { cn } from '../../../../lib/cn'

type Props = {
  active?: boolean
  label?: string
  payload?: unknown
  formatValue?: (value: number, dataKey?: string) => string
  className?: string
}

type Entry = {
  name?: string | number
  value?: number | string
  color?: string
  dataKey?: string | number
}

function asEntries(payload: unknown): Entry[] {
  if (!Array.isArray(payload)) return []
  return payload as Entry[]
}

/** Shared tooltip panel for Recharts hover. */
export function ChartTooltip({ active, label, payload, formatValue, className }: Props) {
  const entries = asEntries(payload)
  if (!active || entries.length === 0) return null

  return (
    <div
      className={cn(
        'rounded-lg border border-line/80 bg-surface-raised px-3 py-2 text-xs shadow-lift',
        className,
      )}
    >
      {label ? <p className="mb-1.5 font-semibold text-ink">{label}</p> : null}
      <div className="space-y-1">
        {entries.map((entry) => {
          const raw = typeof entry.value === 'number' ? entry.value : Number(entry.value ?? 0)
          const key = entry.dataKey != null ? String(entry.dataKey) : String(entry.name ?? '')
          return (
            <div key={`${entry.name}-${key}`} className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5 text-ink-muted">
                <span
                  className="size-2 rounded-full"
                  style={{ backgroundColor: entry.color ?? 'rgb(45 109 246)' }}
                  aria-hidden
                />
                {entry.name}
              </span>
              <span className="font-semibold tabular-nums text-ink">
                {formatValue ? formatValue(raw, key) : String(entry.value ?? '')}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
