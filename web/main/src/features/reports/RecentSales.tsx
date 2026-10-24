"use client";

import { ArrowRight, Receipt } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/shared/EmptyState";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useSalesList } from "@/hooks/queries/useSales";
import { formatMoney, formatRelative } from "@/lib/format";

/** How many of the latest sales the dashboard lists. */
const SHOWN = 6;

/**
 * The last few sales, newest first — the quickest way back to a receipt a
 * customer has just walked off without. A full history is one click away.
 */
export function RecentSales({ currency }: { currency: string }) {
  const { rows, isLoading } = useSalesList();
  const recent = rows.slice(0, SHOWN);

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5 shadow-card md:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Recent sales</h2>
          <p className="text-xs text-muted-foreground">The latest from every till.</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          nativeButton={false}
          render={<Link href="/sales" />}
          className="-mt-1 -mr-2"
        >
          All sales <ArrowRight className="size-3.5" />
        </Button>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-10 w-full" />
          ))}
        </div>
      ) : recent.length === 0 ? (
        <EmptyState size="sm" icon={Receipt} title="No sales yet" />
      ) : (
        <ul className="-mx-2 flex flex-col">
          {recent.map((sale) => (
            <li key={sale.id}>
              <Link
                href={`/sales/${sale.id}`}
                className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground">
                  <Receipt className="size-4" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{sale.number}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {sale.cashier_label ?? "Till"}
                    {sale.sold_at && ` · ${formatRelative(sale.sold_at)}`}
                  </span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1">
                  <span className="text-sm font-semibold tabular-nums">
                    {formatMoney(sale.total, currency)}
                  </span>
                  {sale.status !== "completed" && <StatusBadge status={sale.status} />}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
