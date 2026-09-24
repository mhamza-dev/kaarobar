"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { DataTable, type DataTableColumn } from "@/components/shared/DataTable/DataTable";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useAgeingByCustomer, useCreditAgeing } from "@/hooks/queries/useCustomers";
import { AGEING_BUCKETS, ageingShares } from "@/lib/credit";
import { formatDate, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useSessionStore } from "@/stores/sessionStore";
import type { CustomerAgeing } from "@/types/api/crm";

/** Bar tint per bucket — later buckets read hotter. */
const BUCKET_TONES = [
  "bg-success",
  "bg-warning/60",
  "bg-warning",
  "bg-destructive/70",
  "bg-destructive",
];

/**
 * Who owes what, and how late.
 *
 * The first taste of the reporting pattern: headline figures, a composition
 * bar, and the per-customer rows a collections round is built from — worst
 * first, click through to the customer to record the payment or log the
 * call. Buckets are counted against each customer's own terms by the
 * backend; nothing here re-buckets.
 */
export function ReceivablesReport() {
  const router = useRouter();
  const currency = useSessionStore((state) => state.scope?.business?.currency) ?? "PKR";
  const [asOf, setAsOf] = useState("");

  const totals = useCreditAgeing(asOf || undefined);
  const byCustomer = useAgeingByCustomer(asOf || undefined);

  const rows = [...(byCustomer.data ?? [])].sort(
    (a, b) => (b.oldest_days_overdue ?? 0) - (a.oldest_days_overdue ?? 0),
  );

  const columns: DataTableColumn<CustomerAgeing>[] = [
    {
      key: "customer",
      header: "Customer",
      render: (row) => <span className="font-medium">{row.customer_name ?? "—"}</span>,
    },
    ...AGEING_BUCKETS.map(({ key, label }) => ({
      key,
      header: label,
      align: "end" as const,
      render: (row: CustomerAgeing) => formatMoney(row[key], currency, { showZero: false }),
    })),
    {
      key: "total",
      header: "Total",
      align: "end",
      render: (row) => <span className="font-medium">{formatMoney(row.total, currency)}</span>,
    },
    {
      key: "oldest",
      header: "Oldest",
      align: "end",
      render: (row) =>
        row.oldest_days_overdue && row.oldest_days_overdue > 0
          ? `${row.oldest_days_overdue} days`
          : "—",
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="as-of">As of</Label>
          <Input
            id="as-of"
            type="date"
            value={asOf}
            onChange={(event) => setAsOf(event.target.value)}
            className="w-44"
          />
        </div>
        {totals.data?.as_of && (
          <p className="text-sm text-muted-foreground">
            {totals.data.invoice_count ?? 0} open invoices as of {formatDate(totals.data.as_of)}
          </p>
        )}
      </div>

      {totals.isLoading ? (
        <Skeleton className="h-28 w-full" />
      ) : totals.data ? (
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
          <div>
            <p className="text-xs text-muted-foreground">Total receivable</p>
            <p className="text-2xl font-semibold tabular-nums">
              {formatMoney(totals.data.total, currency)}
            </p>
          </div>
          <div className="flex h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
            {ageingShares(totals.data).map((share, index) => (
              <div
                key={share.key}
                className={BUCKET_TONES[index]}
                style={{ width: `${share.percent}%` }}
              />
            ))}
          </div>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {ageingShares(totals.data).map((share, index) => (
              <div key={share.key}>
                <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className={cn("size-2 rounded-full", BUCKET_TONES[index])} />
                  {share.label}
                </dt>
                <dd className="font-medium tabular-nums">{formatMoney(share.amount, currency)}</dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(row) => row.customer_id}
        loading={byCustomer.isLoading}
        error={byCustomer.error ? { message: byCustomer.error.message } : null}
        onRetry={() => byCustomer.refetch()}
        search={{ getText: (row) => row.customer_name ?? "" }}
        onRowClick={(row) => router.push(`/customers/${row.customer_id}`)}
        empty={
          <p className="p-6 text-center text-sm text-muted-foreground">
            Nobody owes anything. Enjoy it.
          </p>
        }
        mobileCardTitle={(row) => row.customer_name ?? "—"}
        mobileCardSubtitle={(row) =>
          row.oldest_days_overdue ? `Oldest ${row.oldest_days_overdue} days late` : "Not yet due"
        }
        mobileCardFields={[
          { key: "total", label: "Total", render: (row) => formatMoney(row.total, currency) },
        ]}
      />
    </div>
  );
}
