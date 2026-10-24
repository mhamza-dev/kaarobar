import { ArrowDownRight, ArrowUpRight, Minus, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { formatChange } from "@/lib/trend";
import { cn } from "@/lib/utils";

/**
 * One headline figure: what it is, the number, and how it moved.
 *
 * `change` is a fraction (0.12 for +12%) and `changeLabel` says against
 * what — "vs yesterday". Rising is good unless `invert` says otherwise
 * (expenses, overdue money), so the colour carries meaning, not just sign.
 */
export function StatCard({
  label,
  value,
  icon: Icon,
  change,
  changeLabel,
  invert,
  hint,
  loading,
  className,
}: {
  label: string;
  value: ReactNode;
  icon?: LucideIcon;
  change?: number | null;
  changeLabel?: string;
  invert?: boolean;
  hint?: ReactNode;
  loading?: boolean;
  className?: string;
}) {
  const hasChange = change !== undefined && change !== null;
  const direction = !hasChange ? 0 : Math.round(change * 100) === 0 ? 0 : change > 0 ? 1 : -1;
  const good = invert ? direction < 0 : direction > 0;
  const Arrow = direction > 0 ? ArrowUpRight : direction < 0 ? ArrowDownRight : Minus;

  return (
    <div
      className={cn(
        "flex min-w-0 flex-col rounded-xl border border-border bg-card p-4 shadow-card md:p-5",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        {Icon && (
          <span className="-mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
            <Icon className="size-4" aria-hidden />
          </span>
        )}
      </div>
      {loading ? (
        <Skeleton className="mt-2 h-8 w-32" />
      ) : (
        <p className="mt-1.5 text-2xl font-semibold tracking-tight break-words tabular-nums md:text-[1.65rem]">
          {value}
        </p>
      )}
      {(hasChange || hint) && (
        <div className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs">
          {hasChange && (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-medium",
                direction === 0
                  ? "bg-muted text-foreground/75"
                  : good
                    ? "bg-success-soft text-success"
                    : "bg-danger-soft text-danger",
              )}
            >
              <Arrow className="size-3" aria-hidden />
              {formatChange(change)}
            </span>
          )}
          {hasChange && changeLabel && <span className="text-muted-foreground">{changeLabel}</span>}
          {hint && <span className="text-muted-foreground">{hint}</span>}
        </div>
      )}
    </div>
  );
}
