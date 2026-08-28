import type { ReactNode } from 'react'
import { cn } from '../../../lib/cn'
import { Button, Tooltip } from '../../../components/ui'

export type RowAction = {
  id: string
  label: string
  icon?: ReactNode
  danger?: boolean
  disabled?: boolean
  onSelect: () => void
}

type Props = {
  actions: RowAction[]
  label?: string
}

export function RowActionButtons({ actions }: Props) {
  if (actions.length === 0) return <span className="text-ink-muted">—</span>

  return (
    <div className="inline-flex items-center justify-end gap-0.5" data-row-click-ignore="true">
      {actions.map((action) => (
        <Tooltip key={action.id} label={action.label}>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={action.disabled}
            aria-label={action.label}
            className={cn(
              'size-8 shrink-0 px-0',
              action.danger
                ? 'text-danger hover:bg-danger-soft hover:text-danger'
                : 'text-ink-muted hover:text-ink',
            )}
            onClick={(e) => {
              e.stopPropagation()
              action.onSelect()
            }}
          >
            {action.icon ?? <span className="text-xs font-bold">{action.label.slice(0, 1)}</span>}
          </Button>
        </Tooltip>
      ))}
    </div>
  )
}

/** @deprecated Prefer RowActionButtons — kept for import compatibility */
export const RowActionsMenu = RowActionButtons
