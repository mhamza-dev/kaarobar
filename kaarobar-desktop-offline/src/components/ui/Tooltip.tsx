import {
  useCallback,
  useId,
  useRef,
  useState,
  type ReactNode,
  type FocusEvent,
  type MouseEvent,
  cloneElement,
  isValidElement,
} from 'react'
import { createPortal } from 'react-dom'
import { cn } from '../../lib/cn'

type Props = {
  label: string
  children: ReactNode
  side?: 'top' | 'bottom'
  className?: string
}

export function Tooltip({ label, children, side = 'top', className }: Props) {
  const id = useId()
  const triggerRef = useRef<HTMLSpanElement>(null)
  const [open, setOpen] = useState(false)
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearTimer = () => {
    if (timer.current) {
      clearTimeout(timer.current)
      timer.current = null
    }
  }

  const show = useCallback(() => {
    if (!label.trim()) return
    clearTimer()
    timer.current = setTimeout(() => {
      const el = triggerRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      setCoords({
        top: side === 'top' ? rect.top - 8 : rect.bottom + 8,
        left: rect.left + rect.width / 2,
      })
      setOpen(true)
    }, 180)
  }, [label, side])

  const hide = useCallback(() => {
    clearTimer()
    setOpen(false)
  }, [])

  function onFocus(e: FocusEvent) {
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return
    show()
  }

  function onBlur(e: FocusEvent) {
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return
    hide()
  }

  function onMouseEnter(_e: MouseEvent) {
    show()
  }

  const child =
    isValidElement<{ 'aria-describedby'?: string }>(children)
      ? cloneElement(children, {
          'aria-describedby': open ? id : children.props['aria-describedby'],
        })
      : children

  return (
    <span
      ref={triggerRef}
      className={cn('inline-flex', className)}
      onMouseEnter={onMouseEnter}
      onMouseLeave={hide}
      onFocus={onFocus}
      onBlur={onBlur}
    >
      {child}
      {open && coords && label.trim() && typeof document !== 'undefined'
        ? createPortal(
            <span
              id={id}
              role="tooltip"
              className={cn(
                'pointer-events-none fixed z-[100] -translate-x-1/2 whitespace-nowrap rounded-lg bg-brand-primary px-2.5 py-1.5 text-xs font-semibold text-brand-on-primary shadow-glow',
                side === 'top' ? '-translate-y-full' : undefined,
              )}
              style={{ top: coords.top, left: coords.left }}
            >
              {label}
            </span>,
            document.body,
          )
        : null}
    </span>
  )
}
