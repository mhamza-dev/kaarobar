import { useEffect, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '../../lib/cn'
import { Button } from './Button'

export type ModalProps = {
  open: boolean
  onClose: () => void
  title?: ReactNode
  description?: ReactNode
  children: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizeClass = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
} as const

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  className,
}: ModalProps) {
  const { t } = useTranslation()
  const titleId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const previouslyFocused = useRef<HTMLElement | null>(null)
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!open) return
    previouslyFocused.current = document.activeElement as HTMLElement | null
    const dialog = dialogRef.current
    const focusable = dialog?.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    )
    focusable?.[0]?.focus()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCloseRef.current()
        return
      }
      if (event.key !== 'Tab' || !dialog || !focusable || focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      previouslyFocused.current?.focus()
    }
  }, [open])

  // Portal to <body>: `position: fixed` is measured against the nearest
  // transformed ancestor, and pages/cards animate with transforms — rendering
  // in place can trap the dialog inside whatever card opened it.
  return createPortal(
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
          <motion.button
            type="button"
            aria-label={t('common.close')}
            className="absolute inset-0 bg-brand-primary/20 backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? titleId : undefined}
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            className={cn(
              'relative z-10 flex max-h-[calc(100vh-1.5rem)] w-full flex-col overflow-hidden rounded-lg border border-white/40 bg-surface-raised/85 shadow-lift backdrop-blur-xl sm:max-h-[calc(100vh-2rem)]',
              sizeClass[size],
              className,
            )}
          >
            <div className="flex items-start justify-between gap-3 border-b border-white/30 bg-surface-raised/60 px-5 py-4 backdrop-blur-md">
              <div className="min-w-0">
                {title ? (
                  <h2 id={titleId} className="text-lg font-semibold leading-snug text-ink">
                    {title}
                  </h2>
                ) : null}
                {description ? <p className="mt-1 text-sm text-ink-muted">{description}</p> : null}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="shrink-0"
                aria-label={t('common.close')}
                onClick={onClose}
              >
                <X className="size-4" />
              </Button>
            </div>
            <div className="overflow-y-auto px-5 py-4">{children}</div>
            {footer ? (
              <div className="flex flex-col-reverse gap-2 border-t border-white/30 bg-surface-raised/60 px-5 py-4 backdrop-blur-md sm:flex-row sm:items-center sm:justify-end">
                {footer}
              </div>
            ) : null}
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>,
    document.body,
  )
}
