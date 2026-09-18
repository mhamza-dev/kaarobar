"use client";

import { DataTable, type DataTableColumn } from "@/components/shared/DataTable/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { usePayablesAgeing, useSupplierBills } from "@/hooks/queries/usePurchasing";
import { formatDate, formatMoney } from "@/lib/format";
import { useSessionStore } from "@/stores/sessionStore";
import type { SupplierBill } from "@/types/api/purchasing";

/** The payables ageing buckets, as the strip a bills screen leads with. */
function AgeingSummary({ currency }: { currency: string }) {
  const { data } = usePayablesAgeing();
  if (!data) return null;

  const buckets = [
    { label: "Current", value: data.current },
    { label: "1–30 days", value: data.overdue_1_30 },
    { label: "31–60 days", value: data.overdue_31_60 },
    { label: "61–90 days", value: data.overdue_61_90 },
    { label: "90+ days", value: data.overdue_90_plus },
  ].filter((bucket) => bucket.value !== undefined);

  return (
    <div className="mb-4 grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
      {buckets.map((bucket) => (
        <div key={bucket.label} className="rounded-lg border border-border p-3">
          <p className="text-xs text-muted-foreground">{bucket.label}</p>
          <p className="text-sm font-medium">{formatMoney(bucket.value, currency)}</p>
        </div>
      ))}
    </div>
  );
}

export function SupplierBillsTable() {
  const currency = useSessionStore((state) => state.scope?.business?.currency) ?? "PKR";
  const { data, isLoading, error, refetch } = useSupplierBills();

  const columns: DataTableColumn<SupplierBill>[] = [
    {
      key: "number",
      header: "Bill",
      render: (bill) => (
        <div>
          <p className="font-medium">{bill.number}</p>
          {bill.supplier_invoice_number && (
            <p className="text-xs text-muted-foreground">{bill.supplier_invoice_number}</p>
          )}
        </div>
      ),
    },
    { key: "supplier", header: "Supplier", render: (bill) => bill.supplier?.name ?? "—" },
    {
      key: "due",
      header: "Due",
      render: (bill) => (
        <div className="flex items-center gap-1.5">
          {formatDate(bill.due_on)}
          {bill.overdue && <Badge variant="destructive">Overdue</Badge>}
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (bill) => <StatusBadge status={bill.status} />,
    },
    {
      key: "total",
      header: "Total",
      align: "end",
      render: (bill) => formatMoney(bill.total, bill.currency ?? currency),
    },
    {
      key: "outstanding",
      header: "Outstanding",
      align: "end",
      render: (bill) => (
        <span className="font-medium">
          {formatMoney(bill.outstanding, bill.currency ?? currency)}
        </span>
      ),
    },
  ];

  return (
    <>
      <AgeingSummary currency={currency} />

      <DataTable
        columns={columns}
        rows={data ?? []}
        rowKey={(bill) => bill.id}
        loading={isLoading}
        error={error ? { message: error.message } : null}
        onRetry={() => refetch()}
        search={{ getText: (bill) => `${bill.number} ${bill.supplier?.name ?? ""}` }}
        filters={[
          {
            id: "overdue",
            label: "Overdue",
            type: "boolean",
            getValue: (bill) => bill.overdue,
          },
        ]}
        mobileCardTitle={(bill) => bill.number}
        mobileCardSubtitle={(bill) => bill.supplier?.name ?? ""}
        mobileCardFields={[
          {
            key: "outstanding",
            label: "Outstanding",
            render: (bill) => formatMoney(bill.outstanding, currency),
          },
        ]}
      />
    </>
  );
}
