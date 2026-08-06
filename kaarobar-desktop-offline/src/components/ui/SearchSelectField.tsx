import { Search, Check, ChevronDown } from 'lucide-react'
import {
  forwardRef,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type ButtonHTMLAttributes,
} from 'react'
import { createPortal } from 'react-dom'
import { cn } from '../../lib/cn'
import type { SelectOption } from './SelectField'
import { TextField } from './TextField'

export type SearchSelectFieldProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'value' | 'onChange'> & {
  label?: ReactNode
  hint?: ReactNode
  error?: ReactNode
  options: SelectOption[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: ReactNode
  containerClassName?: string
}

type MenuPosition = {
  top: number
  left: number
  width: number
  maxHeight: number
  openUpward: boolean
}

export const SearchSelectField = forwardRef<HTMLButtonElement, SearchSelectFieldProps>(
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
    const triggerRef = useRef<HTMLButtonElement | null>(null)
    const menuRef = useRef<HTMLDivElement>(null)
    const [open, setOpen] = useState(false)
    const [query, setQuery] = useState('')
    const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null)

    const selected = options.find((option) => option.value === value)
    const filteredOptions = useMemo(() => {
      const normalized = query.trim().toLowerCase()
      if (!normalized) return options
      return options.filter((option) => option.label.toLowerCase().includes(normalized))
    }, [options, query])

    const setTriggerRef = (node: HTMLButtonElement | null) => {
      triggerRef.current = node
      if (typeof ref === 'function') ref(node)
      else if (ref) ref.current = node
    }

    const updateMenuPosition = () => {
      const trigger = triggerRef.current
      if (!trigger) return
      const rect = trigger.getBoundingClientRect()
      const gap = 8
      const preferredMax = 280
      const spaceBelow = window.innerHeight - rect.bottom - gap - 8
      const spaceAbove = rect.top - gap - 8
      const openUpward = spaceBelow < 160 && spaceAbove > spaceBelow
      const available = openUpward ? spaceAbove : spaceBelow
      setMenuPosition({
        top: openUpward ? rect.top - gap : rect.bottom + gap,
        left: rect.left,
        width: rect.width,
        maxHeight: Math.max(140, Math.min(preferredMax, available)),
        openUpward,
      })
    }

    useLayoutEffect(() => {
      if (!open) {
        setMenuPosition(null)
        return
      }
      updateMenuPosition()
      const onReposition = () => updateMenuPosition()
      window.addEventListener('resize', onReposition)
      window.addEventListener('scroll', onReposition, true)
      return () => {
        window.removeEventListener('resize', onReposition)
        window.removeEventListener('scroll', onReposition, true)
      }
    }, [open])

    useEffect(() => {
      if (!open) return
      const onPointerDown = (event: MouseEvent) => {
        const target = event.target as Node
        if (rootRef.current?.contains(target)) return
        if (menuRef.current?.contains(target)) return
        setOpen(false)
        setQuery('')
      }
      window.addEventListener('mousedown', onPointerDown)
      return () => window.removeEventListener('mousedown', onPointerDown)
    }, [open])

    const menu =
      open && menuPosition
        ? createPortal(
            <div
              ref={menuRef}
              className="fixed z-[200] rounded-lg border border-line bg-surface-raised p-2 shadow-lift"
              style={{
                top: menuPosition.openUpward ? undefined : menuPosition.top,
                bottom: menuPosition.openUpward
                  ? window.innerHeight - menuPosition.top
                  : undefined,
                left: menuPosition.left,
                width: menuPosition.width,
                maxHeight: menuPosition.maxHeight,
              }}
              role="presentation"
            >
              <div className="relative shrink-0">
                <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-ink-subtle" />
                <TextField
                  autoFocus
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={searchPlaceholder ?? 'Search...'}
                  className="h-9 ps-9"
                  containerClassName="w-full"
                  onKeyDown={(event) => {
                    if (event.key === 'Escape') {
                      event.stopPropagation()
                      setOpen(false)
                      setQuery('')
                    }
                  }}
                />
              </div>
              <div
                className="mt-2 min-h-0 flex-1 space-y-1 overflow-y-auto"
                style={{ maxHeight: Math.max(80, menuPosition.maxHeight - 56) }}
                role="listbox"
              >
                {filteredOptions.length === 0 ? (
                  <p className="px-2 py-1.5 text-sm text-ink-muted">{emptyText ?? 'No options found'}</p>
                ) : (
                  filteredOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      role="option"
                      aria-selected={value === option.value}
                      disabled={option.disabled}
                      className={cn(
                        'flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-sm text-ink hover:bg-surface-muted',
                        option.disabled && 'cursor-not-allowed opacity-50',
                        value === option.value && 'bg-brand-tint/50',
                      )}
                      onClick={() => {
                        if (option.disabled) return
                        onChange(option.value)
                        setOpen(false)
                        setQuery('')
                      }}
                    >
                      <span>{option.label}</span>
                      {value === option.value ? <Check className="size-4 text-brand-primary" /> : null}
                    </button>
                  ))
                )}
              </div>
            </div>,
            document.body,
          )
        : null

    return (
      <div className={cn('flex w-full flex-col gap-1.5', containerClassName)}>
        {label ? (
          <label htmlFor={fieldId} className="text-sm font-medium text-ink">
            {label}
          </label>
        ) : null}
        <div ref={rootRef} className="relative">
          <button
            ref={setTriggerRef}
            id={fieldId}
            type="button"
            disabled={disabled}
            className={cn(
              'h-11 w-full rounded-lg border bg-surface-raised px-3.5 text-left text-sm text-ink shadow-soft outline-none transition-colors duration-pos',
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
            <span className={cn(!selected ? 'text-ink-subtle' : undefined)}>
              {selected?.label ?? placeholder ?? 'Select an option'}
            </span>
            <ChevronDown className="size-4 shrink-0 text-ink-subtle" />
          </button>
          {menu}
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

SearchSelectField.displayName = 'SearchSelectField'
