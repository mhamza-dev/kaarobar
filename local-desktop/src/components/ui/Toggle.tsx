import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { cn } from '../../lib/cn'

export type ToggleProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> & {
  checked: boolean
  onCheckedChange?: (checked: boolean) => void
  label?: ReactNode
  hint?: ReactNode
}

export const Toggle = forwardRef<HTMLButtonElement, ToggleProps>(
  ({ checked, onCheckedChange, label, hint, className, disabled, id, ...props }, ref) => {
    const fieldId = id ?? props.name

    return (
      <div className="flex flex-col gap-1.5">
        <div className="inline-flex items-center gap-3">
          <button
            ref={ref}
            id={fieldId}
            type="button"
            role="switch"
            aria-checked={checked}
            disabled={disabled}
            onClick={() => onCheckedChange?.(!checked)}
            className={cn(
              'relative h-6 w-11 shrink-0 overflow-hidden rounded-full transition-colors duration-pos focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-primary/40',
              checked ? 'bg-brand-primary' : 'bg-line-strong',
              disabled && 'cursor-not-allowed opacity-60',
              className,
            )}
            {...props}
          >
            <span
              aria-hidden
              className={cn(
                'pointer-events-none absolute top-0.5 size-5 rounded-full bg-white shadow-soft transition-[inset-inline-start] duration-pos',
                checked ? 'start-[calc(100%-1.375rem)]' : 'start-0.5',
              )}
            />
          </button>
          {label ? (
            <label htmlFor={fieldId} className="min-w-0 text-sm font-medium text-ink">
              {label}
            </label>
          ) : null}
        </div>
        {hint ? <p className="text-xs leading-relaxed text-ink-muted">{hint}</p> : null}
      </div>
    )
  },
)

Toggle.displayName = 'Toggle'
