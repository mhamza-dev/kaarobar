import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '../../lib/cn'

type ToastTone = 'default' | 'success' | 'danger' | 'warning'

type ToastItem = {
  id: string
  title: string
  description?: string
  tone?: ToastTone
}

type ToastContextValue = {
  push: (toast: Omit<ToastItem, 'id'>) => void
  success: (title: string, description?: string) => void
  error: (title: string, description?: string) => void
  warning: (title: string, description?: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const TONE_STYLES: Record<
  ToastTone,
  { icon: typeof Info; chip: string; rail: string; edge: string }
> = {
  default: {
    icon: Info,
    chip: 'bg-brand-tint text-brand-primary',
    rail: 'bg-brand-primary',
    edge: 'border-s-brand-primary',
  },
  success: {
    icon: CheckCircle2,
    chip: 'bg-success-soft text-success',
    rail: 'bg-success',
    edge: 'border-s-success',
  },
  danger: {
    icon: XCircle,
    chip: 'bg-danger-soft text-danger',
    rail: 'bg-danger',
    edge: 'border-s-danger',
  },
  warning: {
    icon: AlertTriangle,
    chip: 'bg-warning-soft text-warning',
    rail: 'bg-warning',
    edge: 'border-s-warning',
  },
}

/**
 * How long a toast stays, from how long it takes to read.
 *
 * A fixed 4.2s was fine for "Saved" and far too short for "Could not delete:
 * INV-0007, INV-0011, INV-0019" — the cashier needs to write those down. Time
 * scales with length, and failures get a floor, because a message you are
 * meant to act on should outlast one you only need to notice.
 */
function readingTime(item: ToastItem): number {
  const words = `${item.title} ${item.description ?? ''}`.trim().split(/\s+/).length
  const base = 2400 + words * 320
  const floor = item.tone === 'danger' || item.tone === 'warning' ? 6500 : 3800
  return Math.min(Math.max(base, floor), 14000)
}

const TICK_MS = 50

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])

  const dismiss = useCallback((id: string) => {
    setItems((current) => current.filter((item) => item.id !== id))
  }, [])

  const push = useCallback((toast: Omit<ToastItem, 'id'>) => {
    const id = crypto.randomUUID()
    // Three is as many as anyone reads. Beyond that the oldest goes, so a burst
    // of failures from one bulk action does not bury the newest under a stack
    // that runs off the screen.
    setItems((current) => [...current, { ...toast, id }].slice(-3))
  }, [])

  const value = useMemo(
    () => ({
      push,
      success: (title: string, description?: string) =>
        push({ title, description, tone: 'success' }),
      error: (title: string, description?: string) => push({ title, description, tone: 'danger' }),
      warning: (title: string, description?: string) =>
        push({ title, description, tone: 'warning' }),
    }),
    [push],
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-4 z-[60] flex flex-col items-center gap-2.5 px-4">
        <AnimatePresence initial={false}>
          {items.map((item) => (
            <ToastCard key={item.id} item={item} onDismiss={dismiss} />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}

/**
 * One toast, owning its own clock.
 *
 * The countdown lives here rather than in a `setTimeout` at the provider so the
 * draining rail and the actual dismissal are the same number. A bar that
 * animates while a timer runs separately drifts apart the moment the tab is
 * throttled, and then the bar is decoration that lies.
 *
 * Hovering or focusing pauses it. Someone copying three invoice numbers out of
 * an error should not lose it halfway through because the clock ran on.
 */
function ToastCard({ item, onDismiss }: { item: ToastItem; onDismiss: (id: string) => void }) {
  const { t } = useTranslation()
  const tone = TONE_STYLES[item.tone ?? 'default']
  const Icon = tone.icon
  const reduceMotion = useReducedMotion()
  // Fixed at mount: a toast that recalculated its own lifespan on every tick
  // would never finish counting down.
  const [duration] = useState(() => readingTime(item))
  const [remaining, setRemaining] = useState(duration)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    if (paused) return
    const timer = window.setInterval(() => {
      setRemaining((value) => Math.max(value - TICK_MS, 0))
    }, TICK_MS)
    return () => window.clearInterval(timer)
  }, [paused])

  useEffect(() => {
    if (remaining === 0) onDismiss(item.id)
  }, [remaining, item.id, onDismiss])

  const isAlert = item.tone === 'danger' || item.tone === 'warning'

  return (
    <motion.div
      layout
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -16, scale: 0.97 }}
      animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 420, damping: 32 }}
      onHoverStart={() => setPaused(true)}
      onHoverEnd={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      role={isAlert ? 'alert' : 'status'}
      aria-live={isAlert ? 'assertive' : 'polite'}
      className={cn(
        'pointer-events-auto relative flex w-full max-w-md gap-3 overflow-hidden',
        // Opaque, not frosted. A translucent card over a dense POS table was
        // reading as washed-out grey; a solid surface with a real shadow is
        // legible at arm's length across a counter, which is where this is read.
        'rounded-xl border border-line/70 bg-surface-raised shadow-lift',
        // The tone edge, the same mark the confirm dialog uses.
        'border-s-[3px]',
        tone.edge,
        'p-3.5 pb-4',
      )}
    >
      <span
        aria-hidden
        className={cn('grid size-8 shrink-0 place-items-center rounded-lg', tone.chip)}
      >
        <Icon className="size-[17px]" strokeWidth={2.3} />
      </span>

      <div className="min-w-0 flex-1 pt-0.5">
        {/* No truncation. Every message in this app arrives as `title`, so
            clipping it to one line hid exactly the part worth reading — which
            invoices failed, which product ran out. Long unbroken runs of ids
            break rather than force the card wider. */}
        <p className="text-sm font-semibold leading-snug text-ink [overflow-wrap:anywhere]">
          {item.title}
        </p>
        {item.description ? (
          <p className="mt-1 text-[13px] leading-relaxed text-ink-muted [overflow-wrap:anywhere]">
            {item.description}
          </p>
        ) : null}
      </div>

      <button
        type="button"
        aria-label={t('common.close')}
        className="-me-1 -mt-1 h-8 w-8 shrink-0 rounded-lg text-ink-subtle transition-colors duration-pos hover:bg-surface-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/40"
        onClick={() => onDismiss(item.id)}
      >
        <X className="mx-auto size-4" />
      </button>

      {/* The clock, drawn. It says how long is left to read, and pauses under
          the cursor — so the card is honest about its own behaviour instead of
          vanishing mid-sentence. */}
      <span
        aria-hidden
        className={cn(
          'absolute inset-x-0 bottom-0 h-[3px] origin-left transition-[width] ease-linear',
          paused ? 'opacity-40' : 'opacity-100',
          tone.rail,
        )}
        style={{
          width: `${(remaining / duration) * 100}%`,
          transitionDuration: `${TICK_MS}ms`,
        }}
      />
    </motion.div>
  )
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
