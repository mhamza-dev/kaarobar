import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from 'react'
import { cn } from '../../lib/cn'

export type TabItem = {
  id: string
  label: ReactNode
  disabled?: boolean
}

export type TabsProps = {
  items: TabItem[]
  value: string
  onValueChange: (id: string) => void
  className?: string
}

export function Tabs({ items, value, onValueChange, className }: TabsProps) {
  const baseId = useId()
  const refs = useRef<Array<HTMLButtonElement | null>>([])

  useEffect(() => {
    refs.current = refs.current.slice(0, items.length)
  }, [items.length])

  function focusByIndex(index: number) {
    const enabled = items
      .map((item, i) => ({ item, i }))
      .filter(({ item }) => !item.disabled)
    if (enabled.length === 0) return
    const currentPos = enabled.findIndex(({ i }) => i === index)
    const next = enabled[(currentPos + enabled.length) % enabled.length]
    refs.current[next.i]?.focus()
    onValueChange(items[next.i].id)
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault()
      let next = index + 1
      while (next < items.length && items[next].disabled) next += 1
      if (next >= items.length) next = items.findIndex((item) => !item.disabled)
      if (next >= 0) focusByIndex(next)
    }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault()
      let prev = index - 1
      while (prev >= 0 && items[prev].disabled) prev -= 1
      if (prev < 0) {
        for (let i = items.length - 1; i >= 0; i -= 1) {
          if (!items[i].disabled) {
            prev = i
            break
          }
        }
      }
      if (prev >= 0) focusByIndex(prev)
    }
    if (event.key === 'Home') {
      event.preventDefault()
      const first = items.findIndex((item) => !item.disabled)
      if (first >= 0) focusByIndex(first)
    }
    if (event.key === 'End') {
      event.preventDefault()
      for (let i = items.length - 1; i >= 0; i -= 1) {
        if (!items[i].disabled) {
          focusByIndex(i)
          break
        }
      }
    }
  }

  return (
    <div
      role="tablist"
      aria-orientation="horizontal"
      className={cn(
        'inline-flex rounded-lg border border-line bg-surface-muted p-1',
        className,
      )}
    >
      {items.map((item, index) => {
        const active = item.id === value
        const tabId = `${baseId}-tab-${item.id}`
        const panelId = `${baseId}-panel-${item.id}`
        return (
          <button
            key={item.id}
            ref={(el) => {
              refs.current[index] = el
            }}
            type="button"
            role="tab"
            id={tabId}
            aria-selected={active}
            aria-controls={panelId}
            tabIndex={active ? 0 : -1}
            disabled={item.disabled}
            onClick={() => onValueChange(item.id)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={cn(
              'rounded-lg px-3.5 py-2 text-sm font-medium transition-colors duration-pos',
              active
                ? 'bg-surface-raised text-ink shadow-soft'
                : 'text-ink-muted hover:text-ink',
              item.disabled && 'cursor-not-allowed opacity-50',
            )}
          >
            {item.label}
          </button>
        )
      })}
    </div>
  )
}
