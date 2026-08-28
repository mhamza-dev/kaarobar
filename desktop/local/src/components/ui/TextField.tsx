import { forwardRef, useState, type InputHTMLAttributes, type ReactNode } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { cn } from '../../lib/cn'

export type TextFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> & {
  label?: ReactNode
  hint?: ReactNode
  error?: ReactNode
  containerClassName?: string
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(
  ({ className, label, hint, error, id, containerClassName, disabled, type, ...props }, ref) => {
    const fieldId = id ?? props.name
    const isPassword = type === 'password'
    const isNumber = type === 'number'
    const [showPassword, setShowPassword] = useState(false)
    const inputType = isPassword && showPassword ? 'text' : type

    return (
      <div className={cn('flex w-full flex-col gap-1.5', containerClassName)}>
        {label ? (
          <label htmlFor={fieldId} className="text-sm font-medium text-ink">
            {label}
          </label>
        ) : null}
        <div className="relative">
          <input
            ref={ref}
            id={fieldId}
            disabled={disabled}
            className={cn(
              'h-11 w-full rounded-lg border bg-surface-raised/90 px-3.5 text-sm text-ink shadow-soft outline-none transition-[border-color,box-shadow,background-color] duration-pos placeholder:text-ink-subtle',
              'hover:border-line-strong focus:border-brand-primary focus:bg-surface-raised focus:ring-1 focus:ring-brand-primary/20',
              error ? 'border-danger focus:border-danger focus:ring-danger/20' : 'border-line/90',
              disabled && 'cursor-not-allowed opacity-60',
              isPassword && 'pe-11',
              isNumber &&
                'appearance-none [-moz-appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
              className,
            )}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined}
            {...props}
            type={inputType}
          />
          {isPassword ? (
            <button
              type="button"
              className="absolute inset-y-0 end-0 grid w-11 place-items-center text-ink-muted transition-colors hover:text-ink"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          ) : null}
        </div>
        {error ? (
          <p id={`${fieldId}-error`} className="text-xs font-medium text-danger">
            {error}
          </p>
        ) : hint ? (
          <p id={`${fieldId}-hint`} className="text-xs text-ink-muted">
            {hint}
          </p>
        ) : null}
      </div>
    )
  },
)

TextField.displayName = 'TextField'
