"use client";

import { format, subDays } from "date-fns";
import { Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { DataTable, type DataTableColumn } from "@/components/shared/DataTable/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { useQuotes, useWinRate } from "@/hooks/queries/useQuotes";
import { usePermission } from "@/hooks/usePermission";
import { formatDate, formatMoney, fractionToPercent } from "@/lib/format";
import { useSessionStore } from "@/stores/sessionStore";
import type { Quote } from "@/types/api/quotes";

/** Quotes, with the last 90 days' win rate on top — the number a firm actually steers by. */
export function QuotesTable() {
  const router = useRouter();
  const { can } = usePermission();
  const currency = useSessionStore((state) => state.scope?.business?.currency) ?? "PKR";
  const [status, setStatus] = useState("");
  const { data, isLoading, error, refetch } = useQuotes({ status: status || undefined });
  const to = format(new Date(), "yyyy-MM-dd");
  const from = format(subDays(new Date(), 90), "yyyy-MM-dd");
  const { data: winRate } = useWinRate(from, to);

  const columns: DataTableColumn<Quote>[] = [
    {
      key: "number",
      header: "Quote",
      render: (quote) => (
        <div>
          <p className="font-medium">{quote.number}</p>
          {quote.title && <p className="text-xs text-muted-foreground">{quote.title}</p>}
        </div>
      ),
    },
    { key: "customer", header: "Customer", render: (quote) => quote.customer?.name ?? "—" },
    {
      key: "valid",
      header: "Valid until",
      render: (quote) => (
        <span className={quote.lapsed ? "text-destructive" : undefined}>
          {formatDate(quote.valid_until)}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (quote) => (
        <StatusBadge status={quote.lapsed && quote.status === "sent" ? "expired" : quote.status} />
      ),
    },
    {
      key: "total",
      header: "Total",
      align: "end",
      render: (quote) => formatMoney(quote.total, quote.currency ?? currency),
    },
  ];

  return (
    <>
      {winRate && (
        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <Stat
            label="Win rate, 90 days"
            value={winRate.win_rate ? `${fractionToPercent(winRate.win_rate)}%` : "—"}
          />
          <Stat label="Won" value={`${winRate.won_count} of ${winRate.decided_count} decided`} />
          <Stat label="Won value" value={formatMoney(winRate.won_value, currency)} />
        </div>
      )}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          aria-label="Filter by status"
          className="h-9 rounded-lg border border-border bg-background px-2 text-sm"
        >
          {/* No status means draft or sent on the backend (Quote.open_statuses). */}
          <option value="">Open</option>
          <option value="draft">Draft</option>
          <option value="sent">Sent</option>
          <option value="accepted">Accepted</option>
          <option value="declined">Declined</option>
          <option value="all">All quotes</option>
        </select>
        {can("quote:manage") && (
          <Button nativeButton={false} render={<Link href="/quotes/new" />}>
            <Plus className="size-4" />
            New quote
          </Button>
        )}
      </div>
      <DataTable
        columns={columns}
        rows={data ?? []}
        rowKey={(quote) => quote.id}
        loading={isLoading}
        error={error ? { message: error.message } : null}
        onRetry={() => refetch()}
        search={{
          getText: (quote) => `${quote.number} ${quote.title ?? ""} ${quote.customer?.name ?? ""}`,
        }}
        onRowClick={(quote) => router.push(`/quotes/${quote.id}`)}
        mobileCardTitle={(quote) => quote.number}
        mobileCardSubtitle={(quote) => quote.customer?.name ?? quote.title ?? ""}
        mobileCardFields={[
          { key: "total", label: "Total", render: (quote) => formatMoney(quote.total, currency) },
        ]}
      />
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}
