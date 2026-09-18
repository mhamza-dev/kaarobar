"use client";

import { DataTable, type DataTableColumn } from "@/components/shared/DataTable/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { useGoodsReceipts } from "@/hooks/queries/usePurchasing";
import { formatDate, formatMoney } from "@/lib/format";
import { useSessionStore } from "@/stores/sessionStore";
import type { GoodsReceipt } from "@/types/api/purchasing";

export function GoodsReceiptsTable() {
  const currency = useSessionStore((state) => state.scope?.business?.currency) ?? "PKR";
  const { data, isLoading, error, refetch } = useGoodsReceipts();

  const columns: DataTableColumn<GoodsReceipt>[] = [
    {
      key: "number",
      header: "Receipt",
      render: (r) => <span className="font-medium">{r.number}</span>,
    },
    { key: "supplier", header: "Supplier", render: (r) => r.supplier?.name ?? "—" },
    {
      key: "order",
      header: "Against order",
      render: (r) => r.purchase_order?.number ?? "—",
    },
    { key: "received", header: "Received", render: (r) => formatDate(r.received_on) },
    {
      key: "status",
      header: "Status",
      render: (r) => (
        // Until posted, nothing has actually entered stock.
        <div className="flex items-center gap-1.5">
          <StatusBadge status={r.status} />
          {!r.posted && <Badge variant="outline">Not posted</Badge>}
        </div>
      ),
    },
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
