"use client";

import { DataTable, type DataTableColumn } from "@/components/shared/DataTable/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { usePurchaseReturns } from "@/hooks/queries/usePurchasing";
import { formatDate, formatMoney } from "@/lib/format";
import { useSessionStore } from "@/stores/sessionStore";
import type { PurchaseReturn } from "@/types/api/purchasing";

export function PurchaseReturnsTable() {
  const currency = useSessionStore((state) => state.scope?.business?.currency) ?? "PKR";
  const { data, isLoading, error, refetch } = usePurchaseReturns();

  const columns: DataTableColumn<PurchaseReturn>[] = [
    {
      key: "number",
      header: "Return",
      render: (r) => <span className="font-medium">{r.number}</span>,
    },
    { key: "supplier", header: "Supplier", render: (r) => r.supplier?.name ?? "—" },
    { key: "reason", header: "Reason", render: (r) => r.reason ?? "—" },
    { key: "returned", header: "Returned", render: (r) => formatDate(r.returned_on) },
    { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
    {
      key: "total",
      header: "Total",
      align: "end",
      render: (r) => formatMoney(r.total, currency),
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={data ?? []}
      rowKey={(r) => r.id}
      loading={isLoading}
      error={error ? { message: error.message } : null}
      onRetry={() => refetch()}
      search={{ getText: (r) => `${r.number} ${r.supplier?.name ?? ""}` }}
      mobileCardTitle={(r) => r.number}
      mobileCardSubtitle={(r) => r.supplier?.name ?? ""}
      mobileCardFields={[
        { key: "total", label: "Total", render: (r) => formatMoney(r.total, currency) },
      ]}
    />
  );
}
