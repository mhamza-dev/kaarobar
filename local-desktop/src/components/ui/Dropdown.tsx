import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { cn } from '../../lib/cn'

export type MenuItem = {
  id: string
  label: ReactNode
  disabled?: boolean
  danger?: boolean
  onSelect?: () => void
}

export type DropdownProps = {
  trigger: ReactNode
  items: MenuItem[]
  align?: 'start' | 'end'
  className?: string
  triggerClassName?: string
  triggerAriaLabel?: string
}

type MenuPosition = {
  top: number
  left: number
  minWidth: number
}

export function Dropdown({
  trigger,
  items,
  align = 'end',
  className,
  triggerClassName,
  triggerAriaLabel,
}: DropdownProps) {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState<MenuPosition | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const menuId = useId()
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([])

  function updatePosition() {
    const triggerEl = rootRef.current
    if (!triggerEl) return
    const rect = triggerEl.getBoundingClientRect()
    const menuWidth = Math.max(176, rect.width)
    const left =
      align === 'end'
        ? Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 8)
        : Math.min(Math.max(8, rect.left), window.innerWidth - menuWidth - 8)
    let top = rect.bottom + 8
    const menuHeight = menuRef.current?.offsetHeight ?? 160
    if (top + menuHeight > window.innerHeight - 8) {
      top = Math.max(8, rect.top - menuHeight - 8)
    }
    setPosition({
      top,
      left: Math.max(8, left),
      minWidth: menuWidth,
    })
  }

  useLayoutEffect(() => {
    if (!open) {
      setPosition(null)
      return
    }
    updatePosition()
  }, [open, align, items.length])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return
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
  }, [open, align])

  function onMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const enabledIndexes = items
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => !item.disabled)
      .map(({ index }) => index)
    if (enabledIndexes.length === 0) return
    const current = enabledIndexes.findIndex((index) => itemRefs.current[index] === document.activeElement)
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      const next = enabledIndexes[(current + 1 + enabledIndexes.length) % enabledIndexes.length]
      itemRefs.current[next]?.focus()
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      const prev = enabledIndexes[(current - 1 + enabledIndexes.length) % enabledIndexes.length]
      itemRefs.current[prev]?.focus()
    }
    if (event.key === 'Home') {
      event.preventDefault()
      itemRefs.current[enabledIndexes[0]]?.focus()
    }
    if (event.key === 'End') {
      event.preventDefault()
      itemRefs.current[enabledIndexes[enabledIndexes.length - 1]]?.focus()
    }
  }

  const menu =
    open && position
      ? createPortal(
          <div
            ref={menuRef}
            id={menuId}
            role="menu"
            tabIndex={-1}
            onKeyDown={onMenuKeyDown}
            style={{
              position: 'fixed',
              top: position.top,
              left: position.left,
              minWidth: position.minWidth,
              zIndex: 80,
            }}
            className="overflow-hidden rounded-lg border border-line bg-surface-raised py-1 shadow-lift"
          >
            {items.map((item, index) => (
              <button
                key={item.id}
                ref={(el) => {
                  itemRefs.current[index] = el
                }}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                className={cn(
                  'flex w-full px-3 py-2 text-start text-sm transition-colors hover:bg-surface-muted disabled:opacity-40',
                  item.danger ? 'text-danger' : 'text-ink',
                )}
                onClick={() => {
                  item.onSelect?.()
                  setOpen(false)
                }}
              >
                {item.label}
              </button>
            ))}
          </div>,
          document.body,
        )
      : null

  return (
    <div ref={rootRef} className={cn('relative inline-flex', className)}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={triggerAriaLabel}
        className={cn(
          'inline-flex min-h-9 min-w-9 items-center justify-center rounded-lg px-2 text-ink-muted hover:bg-surface-muted hover:text-ink',
          triggerClassName,
        )}
        onClick={() => setOpen((value) => !value)}
      >
        {trigger}
      </button>
      {menu}
    </div>
  )
}

export const Menu = Dropdown
