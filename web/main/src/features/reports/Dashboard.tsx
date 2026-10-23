"use client";

import { format, parseISO, subDays } from "date-fns";
import { AlertTriangle, ArrowRight, Banknote, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";

import { BarList } from "@/components/charts/BarList";
import { TrendChart } from "@/components/charts/TrendChart";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useFiscalStatus } from "@/hooks/queries/useFinance";
import {
  useDailySales,
  useProductNames,
  useSalesSummary,
  useTopProducts,
} from "@/hooks/queries/useReports";
import { usePermission } from "@/hooks/usePermission";
import { formatMoney, formatQuantity } from "@/lib/format";
import { getVisibleNavGroups } from "@/lib/nav";
import { compactNumber, presetRange, shopToday } from "@/lib/reportPeriod";
import { cn } from "@/lib/utils";
import { useSessionStore } from "@/stores/sessionStore";

/**
 * The first screen after sign-in. Leads with one number — today's net
 * sales — then the fortnight's shape and what's selling today. Someone
 * without `report:sales` gets their shortcuts instead of a wall of 403s.
 *
 * The fiscal banner is here because it's the one condition that stops the
 * till opening; finding out at the till is too late.
 */
export function Dashboard() {
  const { can } = usePermission();
  const scope = useSessionStore((state) => state.scope);
  const currency = scope?.business?.currency ?? "PKR";
  const canReport = can("report:sales");
  const canSeeFiscal = can("fiscal:view");

  // The shop's today, not the browser's — they differ for hours every day
  // for an owner away from the shop.
  const timezone = scope?.business?.timezone;
  const today = useMemo(() => presetRange("today", shopToday(timezone)), [timezone]);
  const lastFortnight = useMemo(() => {
    const now = shopToday(timezone);
    return { from: format(subDays(now, 13), "yyyy-MM-dd"), to: format(now, "yyyy-MM-dd") };
  }, [timezone]);

  const summary = useSalesSummary(today, canReport);
  const trend = useDailySales(lastFortnight, canReport);
  // Product figures come from the nightly rollups (closed days only), so
  // "today" would always be empty — the week is the honest window.
  const week = useMemo(() => presetRange("7d", shopToday(timezone)), [timezone]);
  const top = useTopProducts(week, canReport);
  const names = useProductNames((top.data ?? []).slice(0, 5).map((row) => row.product_id));
  const fiscal = useFiscalStatus();

  const shortcuts = getVisibleNavGroups(scope)
    .flatMap((group) => group.items)
    .filter((item) => item.href !== "/dashboard")
    .slice(0, 6);

  return (
    <div className="flex flex-col gap-6">
      {canSeeFiscal && fiscal.data?.selling_blocked && (
        <div
          role="alert"
          className="flex flex-wrap items-start gap-3 rounded-xl border border-destructive/30 bg-danger-soft p-4 text-sm"
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-card text-danger shadow-xs">
            <AlertTriangle className="size-[1.125rem]" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-danger">The till is blocked by fiscal reporting</p>
            <p className="text-foreground/80">
              {fiscal.data.backlog} sale{fiscal.data.backlog === 1 ? "" : "s"} couldn&apos;t be
              reported to the tax authority.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link href="/settings/fiscal" />}
          >
            Fix it
          </Button>
        </div>
      )}

      {canReport ? (
        <>
          <section className="grid gap-4 lg:grid-cols-5">
            <div
              className={cn(
                PANEL,
                "relative flex flex-col gap-5 overflow-hidden p-5 md:p-6 lg:col-span-2",
              )}
            >
              <div
                aria-hidden
                className="pointer-events-none absolute -top-20 -right-20 size-56 rounded-full bg-primary/10 blur-3xl"
              />
              <div className="flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                  <Banknote className="size-[1.125rem]" aria-hidden />
                </span>
                <p className="text-sm font-medium text-muted-foreground">Net sales today</p>
              </div>
              {summary.isLoading ? (
                <Skeleton className="h-12 w-48" />
              ) : (
                <p className="text-4xl font-semibold tracking-tight break-words xl:text-5xl">
                  {formatMoney(summary.data?.net_sales, currency)}
                </p>
              )}
              {/* Side by side from sm up; label/value rows on a phone, where three
                  money figures abreast would break mid-number. */}
              <dl className="mt-auto grid divide-y divide-border rounded-lg border border-border bg-muted/40 sm:auto-cols-fr sm:grid-flow-col sm:divide-x sm:divide-y-0">
                <div className="flex min-w-0 items-baseline justify-between gap-3 px-3 py-2.5 sm:block">
                  <dt className="text-xs text-muted-foreground">Sales</dt>
                  <dd className="font-semibold break-words sm:mt-0.5">
                    {summary.data?.sale_count ?? "—"}
                  </dd>
                </div>
                <div className="flex min-w-0 items-baseline justify-between gap-3 px-3 py-2.5 sm:block">
                  <dt className="text-xs text-muted-foreground">Average</dt>
                  <dd className="font-semibold break-words sm:mt-0.5">
                    {formatMoney(summary.data?.average_sale, currency)}
                  </dd>
                </div>
                {can("report:financial") && (
                  <div className="flex min-w-0 items-baseline justify-between gap-3 px-3 py-2.5 sm:block">
                    <dt className="text-xs text-muted-foreground">Gross profit</dt>
                    <dd className="font-semibold break-words sm:mt-0.5">
                      {formatMoney(summary.data?.gross_profit, currency)}
                    </dd>
                  </div>
                )}
              </dl>
            </div>

            <div className={cn(PANEL, "flex flex-col gap-4 p-5 md:p-6 lg:col-span-3")}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold">Net sales</h2>
                  <p className="text-xs text-muted-foreground">Last 14 days</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  nativeButton={false}
                  render={<Link href="/reports" />}
                  className="-mt-1 -mr-2"
                >
                  Reports <ArrowRight className="size-3.5" />
                </Button>
              </div>
              {trend.isLoading ? (
                <Skeleton className="h-52 w-full" />
              ) : (
                <TrendChart
                  height={210}
                  points={(trend.data ?? []).map((row) => ({
                    label: format(parseISO(row.day), "EEE d MMM"),
                    tick: format(parseISO(row.day), "d MMM"),
                    value: Number(row.net_sales),
                    display: formatMoney(row.net_sales, currency),
                    detail: `${row.sale_count} sale${row.sale_count === 1 ? "" : "s"}`,
                  }))}
                  formatAxis={compactNumber}
                  ariaLabel="Net sales for the last 14 days"
                />
              )}
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-5">
            <div className={cn(PANEL, "flex flex-col gap-4 p-5 md:p-6 lg:col-span-3")}>
              <div>
                <h2 className="text-sm font-semibold">Best sellers this week</h2>
                <p className="text-xs text-muted-foreground">Updated as each day closes.</p>
              </div>
              {top.isLoading ? (
                <Skeleton className="h-32 w-full" />
              ) : (
                <BarList
                  emptyMessage="No closed days with sales this week yet."
                  items={(top.data ?? []).slice(0, 5).map((row) => ({
                    key: row.variant_id,
                    label: names[row.product_id] ?? "…",
                    value: Number(row.net_sales),
                    display: formatMoney(row.net_sales, currency),
                    detail: `${formatQuantity(row.quantity)} sold`,
                  }))}
                />
              )}
            </div>

            <QuickLinks items={quickLinks(scope)} />
          </section>
        </>
      ) : shortcuts.length > 0 ? (
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {shortcuts.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                PANEL,
                "group flex items-center gap-3 p-4 transition-colors hover:border-primary/40 hover:bg-accent/30",
              )}
            >
              <span className="flex size-10 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                <item.icon className="size-5" aria-hidden />
              </span>
              <span className="flex-1 font-medium">{item.label}</span>
              <ChevronRight
                className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                aria-hidden
              />
            </Link>
          ))}
        </section>
      ) : (
        <EmptyState
          title="Nothing to show yet"
          description="Ask an owner to give your role access to the screens you need."
        />
      )}
    </div>
  );
}

const PANEL = "rounded-xl border border-border bg-card shadow-card";

/**
 * The everyday jobs, phrased as jobs, in the order a shop reaches for them.
 * Only screens the sidebar would show this person make the list.
 */
const QUICK_LINKS: Array<{ href: string; label: string }> = [
  { href: "/pos", label: "Ring up a sale" },
  { href: "/products", label: "Manage products" },
  { href: "/customers", label: "Find a customer" },
  { href: "/stock", label: "Check stock levels" },
  { href: "/purchase-orders", label: "Order from suppliers" },
  { href: "/expenses", label: "Record an expense" },
  { href: "/sales", label: "Look up a sale" },
];

function quickLinks(scope: Parameters<typeof getVisibleNavGroups>[0]) {
  const visible = new Map(
    getVisibleNavGroups(scope)
      .flatMap((group) => group.items)
      .map((item) => [item.href, item]),
  );
  return QUICK_LINKS.flatMap((link) => {
    const item = visible.get(link.href);
    return item ? [{ ...link, icon: item.icon }] : [];
  }).slice(0, 5);
}

function QuickLinks({ items }: { items: ReturnType<typeof quickLinks> }) {
  if (items.length === 0) return null;

  return (
    <div className={cn(PANEL, "flex flex-col gap-3 p-5 md:p-6 lg:col-span-2")}>
      <h2 className="text-sm font-semibold">Shortcuts</h2>
      <ul className="-mx-2 flex flex-col">
        {items.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className="group flex items-center gap-3 rounded-lg px-2 py-2 text-sm font-medium transition-colors hover:bg-muted"
            >
              <span className="flex size-8 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition-colors group-hover:border-primary/30 group-hover:text-primary">
                <item.icon className="size-4" aria-hidden />
              </span>
              <span className="flex-1">{item.label}</span>
              <ChevronRight
                className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                aria-hidden
              />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
