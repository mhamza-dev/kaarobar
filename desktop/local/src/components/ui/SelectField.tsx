import { Check, ChevronDown } from 'lucide-react'
import {
  forwardRef,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { cn } from '../../lib/cn'

export type SelectOption = {
  value: string
  label: string
  disabled?: boolean
}

export type SelectFieldProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'value' | 'onChange'> & {
  label?: ReactNode
  hint?: ReactNode
  error?: ReactNode
  options: SelectOption[]
  value?: string
  onChange?: (value: string) => void
  placeholder?: string
  containerClassName?: string
  emptyText?: ReactNode
}

type ListboxPosition = {
  top: number
  left: number
  width: number
}

export const SelectField = forwardRef<HTMLButtonElement, SelectFieldProps>(
  (
    {
      className,
      label,
      hint,
      error,
      id,
      name,
      options,
      value = '',
      onChange,
      placeholder,
      containerClassName,
      emptyText,
      disabled,
      ...props
    },
    ref,
  ) => {
    const autoId = useId()
    const fieldId = id ?? name ?? autoId
    const listboxId = `${fieldId}-listbox`
    const triggerWrapRef = useRef<HTMLDivElement>(null)
    const triggerRef = useRef<HTMLButtonElement | null>(null)
    const listboxRef = useRef<HTMLDivElement>(null)
    const [open, setOpen] = useState(false)
    const [position, setPosition] = useState<ListboxPosition | null>(null)

    const selected = options.find((option) => option.value === value)

    function assignTriggerRef(node: HTMLButtonElement | null) {
      triggerRef.current = node
      if (typeof ref === 'function') ref(node)
      else if (ref) ref.current = node
    }

    function updatePosition() {
      const triggerEl = triggerRef.current
      if (!triggerEl) return
      const rect = triggerEl.getBoundingClientRect()
      const width = rect.width
      const gap = 8
      const listboxHeight =
        listboxRef.current?.offsetHeight ?? Math.min(224, 8 + Math.max(1, options.length) * 36)
      const spaceBelow = window.innerHeight - rect.bottom - gap
      const spaceAbove = rect.top - gap
      const openUpward = listboxHeight > spaceBelow && spaceAbove > spaceBelow
      const top = openUpward ? Math.max(8, rect.top - listboxHeight - gap) : rect.bottom + gap
      const left = Math.min(Math.max(8, rect.left), Math.max(8, window.innerWidth - width - 8))
      setPosition({ top, left, width })
    }

    useLayoutEffect(() => {
      if (!open) {
        setPosition(null)
        return
      }
      updatePosition()
    }, [open, options.length])

    // Refine after the portaled listbox mounts so upward flip uses real height.
    useLayoutEffect(() => {
      if (!open || !position || !listboxRef.current) return
      updatePosition()
    }, [open, Boolean(position)])

    useEffect(() => {
      if (!open) return
      const onPointerDown = (event: MouseEvent) => {
        const target = event.target as Node
        if (triggerWrapRef.current?.contains(target) || listboxRef.current?.contains(target)) return
        setOpen(false)
      }
      const onKeyDown = (event: globalThis.KeyboardEvent) => {
        if (event.key === 'Escape') setOpen(false)
      }
      const onReposition = () => updatePosition()
      window.addEventListener('mousedown', onPointerDown)
      window.addEventListener('keydown', onKeyDown)
      window.addEventListener('resize', onReposition)
      window.addEventListener('scroll', onReposition, true)
      return () => {
        window.removeEventListener('mousedown', onPointerDown)
        window.removeEventListener('keydown', onKeyDown)
        window.removeEventListener('resize', onReposition)
        window.removeEventListener('scroll', onReposition, true)
      }
    }, [open, options.length])

    const listbox =
      open && position && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={listboxRef}
              id={listboxId}
              role="listbox"
              style={{
                position: 'fixed',
                top: position.top,
                left: position.left,
                width: position.width,
                zIndex: 80,
              }}
              className="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-line bg-surface-raised p-2 shadow-lift"
            >
              {options.length === 0 ? (
                <p className="px-2 py-1.5 text-sm text-ink-muted">{emptyText ?? 'No options'}</p>
              ) : (
                options.map((option) => (
                  <button
                    key={option.value || '__empty'}
                    type="button"
                    role="option"
                    aria-selected={value === option.value}
                    disabled={option.disabled}
                    className={cn(
                      'flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-start text-sm text-ink hover:bg-surface-muted',
                      option.disabled && 'cursor-not-allowed opacity-50',
                      value === option.value && 'bg-brand-tint/50',
                    )}
                    onClick={() => {
                      if (option.disabled) return
                      onChange?.(option.value)
                      setOpen(false)
                    }}
                  >
                    <span className="min-w-0 truncate">{option.label}</span>
                    {value === option.value ? <Check className="size-4 shrink-0 text-brand-primary" /> : null}
                  </button>
                ))
              )}
            </div>,
            document.body,
          )
        : null

    return (
      <div className={cn('flex flex-col gap-1.5', containerClassName ?? 'w-full')}>
        {label ? (
          <label htmlFor={fieldId} className="text-sm font-medium text-ink">
            {label}
          </label>
        ) : null}
        <div ref={triggerWrapRef} className="relative">
          <button
            ref={assignTriggerRef}
            id={fieldId}
            type="button"
            name={name}
            disabled={disabled}
            className={cn(
              'h-11 w-full rounded-lg border bg-surface-raised/90 px-3.5 text-start text-sm text-ink shadow-soft outline-none transition-[border-color,box-shadow,background-color] duration-pos',
              'hover:border-line-strong focus:border-brand-primary focus:bg-surface-raised focus:ring-1 focus:ring-brand-primary/20',
              'flex items-center justify-between gap-2',
              error ? 'border-danger focus:border-danger focus:ring-danger/20' : 'border-line/90',
              disabled && 'cursor-not-allowed opacity-60',
              className,
            )}
            aria-expanded={open}
            aria-haspopup="listbox"
            aria-controls={listboxId}
            aria-invalid={Boolean(error)}
            onClick={() => {
              if (disabled) return
              setOpen((wasOpen) => !wasOpen)
            }}
            {...props}
          >
            <span className={cn('min-w-0 truncate', !selected ? 'text-ink-subtle' : undefined)}>
              {selected?.label ?? placeholder ?? 'Select an option'}
            </span>
            <ChevronDown
              className={cn('size-4 shrink-0 text-ink-subtle transition-transform', open && 'rotate-180')}
            />
          </button>
          {listbox}
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

SelectField.displayName = 'SelectField'
