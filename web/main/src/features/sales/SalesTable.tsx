"use client";

import { useRouter } from "next/navigation";

import { DataTable, type DataTableColumn } from "@/components/shared/DataTable/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { useSalesList } from "@/hooks/queries/useSales";
import { formatDateTime, formatMoney } from "@/lib/format";
import type { SaleSummary } from "@/types/api/sales";

export function SalesTable() {
  const router = useRouter();
  const { rows, isLoading, error, refetch, hasNextPage, isFetchingNextPage, fetchNextPage } =
    useSalesList();

  const columns: DataTableColumn<SaleSummary>[] = [
    {
      key: "number",
      header: "Receipt",
      render: (sale) => <span className="font-medium">{sale.number}</span>,
    },
    { key: "sold_at", header: "When", render: (sale) => formatDateTime(sale.sold_at) },
    { key: "cashier", header: "Cashier", render: (sale) => sale.cashier_label ?? "—" },
    { key: "status", header: "Status", render: (sale) => <StatusBadge status={sale.status} /> },
    {
      key: "refunded",
      header: "Refunded",
      align: "end",
      render: (sale) =>
        Number(sale.refunded_total ?? 0) > 0
          ? formatMoney(sale.refunded_total, sale.currency)
          : "—",
    },
    {
      key: "total",
      header: "Total",
      align: "end",
      render: (sale) => (
        <span className="font-medium tabular-nums">{formatMoney(sale.total, sale.currency)}</span>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={rows}
      rowKey={(sale) => sale.id}
      loading={isLoading}
      error={error ? { message: error.message } : null}
      onRetry={() => refetch()}
      hasMore={hasNextPage}
      loadingMore={isFetchingNextPage}
      onLoadMore={() => fetchNextPage()}
      search={{ getText: (sale) => `${sale.number} ${sale.cashier_label ?? ""}` }}
      onRowClick={(sale) => router.push(`/sales/${sale.id}`)}
      mobileCardTitle={(sale) => sale.number}
      mobileCardSubtitle={(sale) => formatDateTime(sale.sold_at)}
      mobileCardFields={[
        {
          key: "total",
          label: "Total",
          render: (sale) => formatMoney(sale.total, sale.currency),
        },
      ]}
    />
  );
}
