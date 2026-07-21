"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from "lucide-react";

export type ToastType = "info" | "success" | "error" | "warning";

export type ToastOptions = {
  type?: ToastType;
  duration?: number;
};

type ToastItem = {
  id: string;
  message: string;
  type: ToastType;
  duration: number;
};

type ToastContextValue = {
  toast: (message: string, options?: ToastOptions) => string;
  dismiss: (id: string) => void;
  success: (message: string, duration?: number) => string;
  error: (message: string, duration?: number) => string;
  info: (message: string, duration?: number) => string;
  warning: (message: string, duration?: number) => string;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const DEFAULT_DURATION = 7000;

const styles: Record<
  ToastType,
  { wrap: string; icon: string; Icon: typeof Info }
> = {
  info: {
    wrap: "border-brand/25 bg-brand-light text-heading",
    icon: "text-brand",
    Icon: Info,
  },
  success: {
    wrap: "border-success/30 bg-success-soft text-success",
    icon: "text-success",
    Icon: CheckCircle2,
  },
  error: {
    wrap: "border-danger/30 bg-danger-soft text-danger",
    icon: "text-danger",
    Icon: AlertCircle,
  },
  warning: {
    wrap: "border-warning/30 bg-warning-soft text-warning",
    icon: "text-warning",
    Icon: AlertTriangle,
  },
};

function ToastCard({
  item,
  onDismiss,
}: {
  item: ToastItem;
  onDismiss: (id: string) => void;
}) {
  const { wrap, icon, Icon } = styles[item.type];

  useEffect(() => {
    const timer = window.setTimeout(() => onDismiss(item.id), item.duration);
    return () => window.clearTimeout(timer);
  }, [item.duration, item.id, onDismiss]);

  return (
    <div
      role="status"
      className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-md border px-4 py-3 shadow-lg ${wrap}`}
    >
      <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${icon}`} aria-hidden />
      <p className="flex-1 text-sm font-medium leading-snug">{item.message}</p>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => onDismiss(item.id)}
        className="shrink-0 rounded-md p-1 opacity-70 transition hover:bg-black/5 hover:opacity-100"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(0);

  const dismiss = useCallback((id: string) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, options?: ToastOptions) => {
      const id = `toast-${Date.now()}-${seq.current++}`;
      const duration = options?.duration ?? DEFAULT_DURATION;
      const type = options?.type ?? "info";
      setItems((prev) => [...prev, { id, message, type, duration }]);
      return id;
    },
    []
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      toast,
      dismiss,
      success: (message, duration) =>
        toast(message, { type: "success", duration }),
      error: (message, duration) => toast(message, { type: "error", duration }),
      info: (message, duration) => toast(message, { type: "info", duration }),
      warning: (message, duration) =>
        toast(message, { type: "warning", duration }),
    }),
    [dismiss, toast]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 top-4 z-[200] flex flex-col items-center gap-2 px-4 sm:items-end sm:pr-6"
      >
        {items.map((item) => (
          <ToastCard key={item.id} item={item} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return ctx;
}
