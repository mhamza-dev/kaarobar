import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react'
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
  { icon: typeof Info; bubble: string; bar: string }
> = {
  default: {
    icon: Info,
    bubble: 'bg-brand-tint text-brand-primary',
    bar: 'from-brand-primary/80 to-brand-primary/20',
  },
  success: {
    icon: CheckCircle2,
    bubble: 'bg-success-soft text-success',
    bar: 'from-success/80 to-success/20',
  },
  danger: {
    icon: XCircle,
    bubble: 'bg-danger-soft text-danger',
    bar: 'from-danger/80 to-danger/20',
  },
  warning: {
    icon: AlertTriangle,
    bubble: 'bg-warning-soft text-warning',
    bar: 'from-warning/80 to-warning/20',
  },
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])

  const push = useCallback((toast: Omit<ToastItem, 'id'>) => {
    const id = crypto.randomUUID()
    setItems((current) => [...current, { ...toast, id }])
    window.setTimeout(() => {
      setItems((current) => current.filter((item) => item.id !== id))
    }, 4200)
  }, [])

  const value = useMemo(
    () => ({
      push,
      success: (title: string, description?: string) => push({ title, description, tone: 'success' }),
      error: (title: string, description?: string) => push({ title, description, tone: 'danger' }),
      warning: (title: string, description?: string) => push({ title, description, tone: 'warning' }),
    }),
    [push],
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-4 z-[60] flex flex-col items-center gap-2.5 px-4">
        <AnimatePresence>
          {items.map((item) => {
            const tone = TONE_STYLES[item.tone ?? 'default']
            const Icon = tone.icon
            return (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, y: -18, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.97 }}
                transition={{ type: 'spring', stiffness: 420, damping: 30 }}
                className={cn(
                  // Frosted glass over whatever sits behind it, in both themes.
                  'pointer-events-auto relative flex w-full max-w-sm items-start gap-3 overflow-hidden',
                  'rounded-2xl border border-line/50 bg-surface-raised/75 py-3 pe-3 ps-4',
                  'shadow-lift ring-1 ring-white/20 backdrop-blur-xl backdrop-saturate-150',
                )}
                role="status"
              >
                <span
                  aria-hidden
                  className={cn(
                    'absolute inset-y-2.5 start-1.5 w-1 rounded-full bg-gradient-to-b',
                    tone.bar,
                  )}
                />
                <span
                  aria-hidden
                  className={cn(
                    'grid size-9 shrink-0 place-items-center rounded-xl shadow-soft',
                    tone.bubble,
                  )}
                >
                  <Icon className="size-4" strokeWidth={2.2} />
                </span>
                <div className="min-w-0 flex-1 pt-0.5">
                  <p className="truncate text-sm font-semibold text-ink">{item.title}</p>
                  {item.description ? (
                    <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-ink-muted">
                      {item.description}
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  className="rounded-lg p-1.5 text-ink-subtle transition-colors hover:bg-surface-muted/70 hover:text-ink"
                  onClick={() => setItems((current) => current.filter((t) => t.id !== item.id))}
                >
                  <X className="size-3.5" />
                </button>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
