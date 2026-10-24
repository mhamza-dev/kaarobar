"use client";

import { format } from "date-fns";
import {
  BellRing,
  Boxes,
  CalendarClock,
  ChevronRight,
  CircleCheck,
  HandCoins,
  Undo2,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { useCreditAgeing, useFollowUps } from "@/hooks/queries/useCustomers";
import { useExpiringBatches, useReorderSuggestions } from "@/hooks/queries/useInventory";
import { useRefundRequests } from "@/hooks/queries/useSales";
import { formatMoney } from "@/lib/format";
import { getVisibleNavGroups } from "@/lib/nav";
import { shopToday } from "@/lib/reportPeriod";
import { cn } from "@/lib/utils";
import { useSessionStore } from "@/stores/sessionStore";

type Tone = "danger" | "warning" | "info";

type Item = {
  key: string;
  href: string;
  icon: LucideIcon;
  title: string;
  detail: string;
  tone: Tone;
};

const TONE_CLASSES: Record<Tone, string> = {
  danger: "bg-danger-soft text-danger",
  warning: "bg-warning-soft text-warning",
  info: "bg-accent text-accent-foreground",
};

const plural = (count: number, one: string, many = `${one}s`) =>
  `${count} ${count === 1 ? one : many}`;

/**
 * The jobs waiting on someone, across the screens this person can open:
 * stock to reorder, money owed, follow-ups due, refunds to approve and
 * batches about to expire. Each row is a link to the screen that clears it.
 *
 * Every query is gated on the sidebar's own visibility rules — the same
 * permissions and modules — so a cashier's dashboard doesn't fire requests
 * that would only come back 403.
 */
export function NeedsAttention() {
  const scope = useSessionStore((state) => state.scope);
  const currency = scope?.business?.currency ?? "PKR";
  const timezone = scope?.business?.timezone;
  const visible = useMemo(
    () => new Set(getVisibleNavGroups(scope).flatMap((group) => group.items.map((i) => i.href))),
    [scope],
  );
  const today = useMemo(() => format(shopToday(timezone), "yyyy-MM-dd"), [timezone]);

  const reorder = useReorderSuggestions({}, visible.has("/stock"));
  const ageing = useCreditAgeing(undefined, visible.has("/receivables"));
  const followUps = useFollowUps({ status: "open", due_before: today }, visible.has("/follow-ups"));
  const refunds = useRefundRequests({ status: "pending" }, visible.has("/refund-requests"));
  const expiring = useExpiringBatches(30, visible.has("/batches"));

  const watched = [
    visible.has("/stock") && reorder,
    visible.has("/receivables") && ageing,
    visible.has("/follow-ups") && followUps,
    visible.has("/refund-requests") && refunds,
    visible.has("/batches") && expiring,
  ].filter(Boolean);

  if (watched.length === 0) return null;

  const loading = watched.some((query) => query && query.isLoading);
  const items: Item[] = [];

  const refundCount = refunds.data?.length ?? 0;
  if (visible.has("/refund-requests") && refundCount > 0) {
    items.push({
      key: "refunds",
      href: "/refund-requests",
      icon: Undo2,
      title: `${plural(refundCount, "refund")} to approve`,
      detail: "A customer is waiting at the counter.",
      tone: "danger",
    });
  }

  const overdueFollowUps = (followUps.data ?? []).filter((item) => item.overdue).length;
  const dueFollowUps = followUps.data?.length ?? 0;
  if (visible.has("/follow-ups") && dueFollowUps > 0) {
    items.push({
      key: "follow-ups",
      href: "/follow-ups",
      icon: BellRing,
      title: `${plural(dueFollowUps, "follow-up")} due`,
      detail: overdueFollowUps > 0 ? `${overdueFollowUps} already overdue` : "Due today",
      tone: overdueFollowUps > 0 ? "warning" : "info",
    });
  }

  const reorderCount = reorder.data?.length ?? 0;
  if (visible.has("/stock") && reorderCount > 0) {
    items.push({
      key: "reorder",
      href: "/stock?tab=reorder",
      icon: Boxes,
      title: `${plural(reorderCount, "product")} running low`,
      detail: "At or under the reorder point",
      tone: "warning",
    });
  }

  const owed = Number(ageing.data?.total ?? 0);
  if (visible.has("/receivables") && owed > 0) {
    const overdue =
      Number(ageing.data?.days_1_30 ?? 0) +
      Number(ageing.data?.days_31_60 ?? 0) +
      Number(ageing.data?.days_61_90 ?? 0) +
      Number(ageing.data?.days_over_90 ?? 0);
    items.push({
      key: "receivables",
      href: "/receivables",
      icon: HandCoins,
      title: `${formatMoney(ageing.data?.total, currency)} owed to you`,
      detail:
        overdue > 0
          ? `${plural(ageing.data?.invoice_count ?? 0, "invoice")}, some past due`
          : plural(ageing.data?.invoice_count ?? 0, "open invoice"),
      tone: overdue > 0 ? "warning" : "info",
    });
  }

  const expiringCount = expiring.data?.length ?? 0;
  if (visible.has("/batches") && expiringCount > 0) {
    const expired = (expiring.data ?? []).filter((batch) => batch.expired).length;
    items.push({
      key: "batches",
      href: "/batches",
      icon: CalendarClock,
      title: `${plural(expiringCount, "batch", "batches")} expiring soon`,
      detail: expired > 0 ? `${expired} already past their date` : "Within the next 30 days",
      tone: expired > 0 ? "danger" : "warning",
    });
  }

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5 shadow-card md:p-6">
      <div>
        <h2 className="text-sm font-semibold">Needs attention</h2>
        <p className="text-xs text-muted-foreground">What&apos;s waiting on someone right now.</p>
      </div>

      {loading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-12 w-full" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 py-6 text-center">
          <span className="flex size-10 items-center justify-center rounded-full bg-success-soft text-success">
            <CircleCheck className="size-5" aria-hidden />
          </span>
          <p className="text-sm font-medium">All clear</p>
          <p className="max-w-56 text-xs text-muted-foreground">
            Nothing to reorder, chase or approve. Enjoy the quiet.
          </p>
        </div>
      ) : (
        <ul className="-mx-2 flex flex-col">
          {items.map((item) => (
            <li key={item.key}>
              <Link
                href={item.href}
                className="group flex items-center gap-3 rounded-lg px-2 py-2 transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <span
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-lg",
                    TONE_CLASSES[item.tone],
                  )}
                >
                  <item.icon className="size-4" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{item.title}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {item.detail}
                  </span>
                </span>
                <ChevronRight
                  className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                  aria-hidden
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
