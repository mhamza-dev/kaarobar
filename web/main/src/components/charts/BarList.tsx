"use client";

import { cn } from "@/lib/utils";

export type BarListItem = {
  key: string;
  label: string;
  /** Plot value only; `display` is what a person reads. */
  value: number;
  display: string;
  detail?: string;
};

/**
 * A ranked breakdown — top products, tenders, categories, cashiers — as
 * labelled rows with a thin bar each. Plain HTML rather than a chart
 * library: every value is already printed as text beside its bar, so the
 * list is its own table view, reads correctly to a screen reader, and needs
 * no tooltip to be exact.
 */
export function BarList({
  items,
  emptyMessage = "Nothing in this period.",
  className,
}: {
  items: BarListItem[];
  emptyMessage?: string;
  className?: string;
}) {
  if (items.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">{emptyMessage}</p>;
  }

  const max = Math.max(...items.map((item) => item.value), 0);

  return (
    <ul className={cn("flex flex-col gap-3", className)}>
      {items.map((item) => {
        const width = max > 0 ? Math.max((item.value / max) * 100, item.value > 0 ? 1 : 0) : 0;
        return (
          <li key={item.key} className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 truncate text-foreground">{item.label}</span>
              <span className="shrink-0 font-medium text-foreground tabular-nums">
                {item.display}
              </span>
            </div>
            <div className="h-2 w-full" aria-hidden>
              <div className="h-2 rounded-r-[4px] bg-chart-1" style={{ width: `${width}%` }} />
            </div>
            {item.detail && <span className="text-xs text-muted-foreground">{item.detail}</span>}
          </li>
        );
      })}
    </ul>
  );
}
