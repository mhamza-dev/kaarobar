import { Search, Check, ChevronDown, X } from 'lucide-react'
import {
  forwardRef,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type ButtonHTMLAttributes,
} from 'react'
import { cn } from '../../lib/cn'
import type { SelectOption } from './SelectField'
import { TextField } from './TextField'

export type SearchMultiSelectFieldProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'value' | 'onChange'> & {
  label?: ReactNode
  hint?: ReactNode
  error?: ReactNode
  options: SelectOption[]
  value: string[]
  onChange: (value: string[]) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: ReactNode
  containerClassName?: string
}

export const SearchMultiSelectField = forwardRef<HTMLButtonElement, SearchMultiSelectFieldProps>(
  (
    {
      className,
      label,
      hint,
      error,
      id,
      options,
      value,
      onChange,
      placeholder,
      searchPlaceholder,
      emptyText,
      containerClassName,
      disabled,
      ...props
    },
    ref,
  ) => {
    const fieldId = id ?? props.name
    const rootRef = useRef<HTMLDivElement>(null)
    const [open, setOpen] = useState(false)
    const [query, setQuery] = useState('')

    const selectedOptions = options.filter((option) => value.includes(option.value))
    const filteredOptions = useMemo(() => {
      const normalized = query.trim().toLowerCase()
      if (!normalized) return options
      return options.filter((option) => option.label.toLowerCase().includes(normalized))
    }, [options, query])

    useEffect(() => {
      if (!open) return
      const onPointerDown = (event: MouseEvent) => {
        const target = event.target as Node
        if (rootRef.current?.contains(target)) return
        setOpen(false)
      }
      window.addEventListener('mousedown', onPointerDown)
      return () => window.removeEventListener('mousedown', onPointerDown)
    }, [open])

    function toggleValue(next: string) {
      if (value.includes(next)) {
        onChange(value.filter((entry) => entry !== next))
      } else {
        onChange([...value, next])
      }
    }

    return (
      <div className={cn('flex w-full flex-col gap-1.5', containerClassName)}>
        {label ? (
          <label htmlFor={fieldId} className="text-sm font-medium text-ink">
            {label}
          </label>
        ) : null}
        <div ref={rootRef} className="relative">
          <button
            ref={ref}
            id={fieldId}
            type="button"
            disabled={disabled}
            className={cn(
              'min-h-11 w-full rounded-lg border bg-surface-raised px-3.5 py-2 text-left text-sm text-ink shadow-soft outline-none transition-colors duration-pos',
              'focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/25',
              'flex items-center justify-between gap-2',
              error ? 'border-danger focus:border-danger focus:ring-danger/20' : 'border-line',
              disabled && 'cursor-not-allowed opacity-60',
              className,
            )}
            aria-expanded={open}
            aria-haspopup="listbox"
            aria-invalid={Boolean(error)}
            onClick={() => {
              if (disabled) return
              setOpen((valueOpen) => !valueOpen)
            }}
            {...props}
          >
            <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
              {selectedOptions.length === 0 ? (
                <span className="text-ink-subtle">{placeholder ?? 'Select options'}</span>
              ) : (
                selectedOptions.map((option) => (
                  <span
                    key={option.value}
                    className="inline-flex items-center gap-1 rounded-full bg-surface-muted px-2 py-0.5 text-xs text-ink"
                  >
                    {option.label}
                    <span
                      role="button"
                      tabIndex={0}
                      className="text-ink-muted hover:text-ink"
                      onClick={(event) => {
                        event.stopPropagation()
                        toggleValue(option.value)
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          event.stopPropagation()
                          toggleValue(option.value)
                        }
                      }}
                    >
                      <X className="size-3.5" />
                    </span>
                  </span>
                ))
              )}
            </div>
            <ChevronDown className="size-4 shrink-0 text-ink-subtle" />
          </button>

          {open ? (
            <div className="absolute z-40 mt-2 w-full rounded-lg border border-line bg-surface-raised p-2 shadow-lift">
              <TextField
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={searchPlaceholder ?? 'Search...'}
                className="h-9 ps-8"
                containerClassName="w-full"
              />
              <Search className="pointer-events-none absolute left-4 top-[1.05rem] size-4 text-ink-subtle" />
              <div className="mt-2 max-h-56 space-y-1 overflow-y-auto">
                {filteredOptions.length === 0 ? (
                  <p className="px-2 py-1.5 text-sm text-ink-muted">{emptyText ?? 'No options found'}</p>
                ) : (
                  filteredOptions.map((option) => {
                    const checked = value.includes(option.value)
                    return (
                      <button
                        key={option.value}
                        type="button"
                        disabled={option.disabled}
                        className={cn(
                          'flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-sm text-left text-ink hover:bg-surface-muted',
                          option.disabled && 'cursor-not-allowed opacity-50',
                        )}
                        onClick={() => {
                          if (option.disabled) return
                          toggleValue(option.value)
                        }}
                      >
                        <span>{option.label}</span>
                        {checked ? <Check className="size-4 text-brand-primary" /> : null}
                      </button>
                    )
                  })
                )}
              </div>
            </div>
          ) : null}
        </div>
        {error ? (
          <p className="text-xs font-medium text-danger">{error}</p>
        ) : hint ? (
          <p className="text-xs text-ink-muted">{hint}</p>
        ) : null}
      </div>
    )
  },
)

SearchMultiSelectField.displayName = 'SearchMultiSelectField'
