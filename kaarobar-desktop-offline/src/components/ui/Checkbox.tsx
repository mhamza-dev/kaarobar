import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react'
import { cn } from '../../lib/cn'

export type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  label?: ReactNode
  hint?: ReactNode
  error?: ReactNode
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, hint, error, id, disabled, ...props }, ref) => {
    const fieldId = id ?? props.name

    return (
      <div className="flex flex-col gap-1">
        <label
          htmlFor={fieldId}
          className={cn(
            'inline-flex items-start gap-2.5 text-sm text-ink',
            disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
          )}
        >
          <input
            ref={ref}
            id={fieldId}
            type="checkbox"
            disabled={disabled}
            className={cn(
              'mt-0.5 size-4 shrink-0 rounded border-line text-brand-primary accent-brand-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-primary/40',
              className,
            )}
            {...props}
          />
          {label ? <span className="leading-5">{label}</span> : null}
        </label>
        {error ? (
          <p className="ps-6 text-xs font-medium text-danger">{error}</p>
        ) : hint ? (
          <p className="ps-6 text-xs text-ink-muted">{hint}</p>
        ) : null}
      </div>
    )
  },
)

Checkbox.displayName = 'Checkbox'
