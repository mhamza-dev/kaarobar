import { forwardRef, type ReactNode, type TextareaHTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

export type TextareaFieldProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: ReactNode
  hint?: ReactNode
  error?: ReactNode
  containerClassName?: string
}

export const TextareaField = forwardRef<HTMLTextAreaElement, TextareaFieldProps>(
  ({ className, label, hint, error, id, containerClassName, disabled, rows = 3, ...props }, ref) => {
    const fieldId = id ?? props.name

    return (
      <div className={cn('flex w-full flex-col gap-1.5', containerClassName)}>
        {label ? (
          <label htmlFor={fieldId} className="text-sm font-medium text-ink">
            {label}
          </label>
        ) : null}
        <textarea
          ref={ref}
          id={fieldId}
          rows={rows}
          disabled={disabled}
          className={cn(
            'w-full resize-y rounded-lg border bg-surface-raised/90 px-3.5 py-2.5 text-sm text-ink shadow-soft outline-none transition-[border-color,box-shadow,background-color] duration-pos placeholder:text-ink-subtle',
            'hover:border-line-strong focus:border-brand-primary focus:bg-surface-raised focus:ring-1 focus:ring-brand-primary/20',
            error ? 'border-danger focus:border-danger focus:ring-danger/20' : 'border-line/90',
            disabled && 'cursor-not-allowed opacity-60',
            className,
          )}
          aria-invalid={Boolean(error)}
          {...props}
        />
        {error ? (
          <p className="text-xs font-medium text-danger">{error}</p>
        ) : hint ? (
          <p className="text-xs text-ink-muted">{hint}</p>
        ) : null}
      </div>
    )
  },
)

TextareaField.displayName = 'TextareaField'
