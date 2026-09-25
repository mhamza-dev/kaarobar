"use client";

import { DataTable, type DataTableColumn } from "@/components/shared/DataTable/DataTable";
import { useReorderSuggestions } from "@/hooks/queries/useInventory";
import { formatQuantity } from "@/lib/format";
import type { ReorderSuggestion } from "@/types/api/inventory";

import { stockSheetKey } from "./StockItemSheet";

/**
 * What's at or below its reorder point, net of what's already on order —
 * the backend subtracts `incoming`, so a line already being bought isn't
 * suggested twice.
 */
export function ReorderTable({
  branchId,
  onOpen,
}: {
  branchId?: string;
  onOpen: (key: string) => void;
}) {
  const { data, isLoading, error, refetch } = useReorderSuggestions({ branch_id: branchId });

  const columns: DataTableColumn<ReorderSuggestion>[] = [
    {
      key: "product",
      header: "Product",
      render: (row) => (
        <div>
          <p className="font-medium">{row.variant?.product?.name ?? row.variant?.name ?? "—"}</p>
          <p className="text-xs text-muted-foreground">{row.variant?.sku ?? ""}</p>
        </div>
      ),
    },
    {
      key: "available",
      header: "Available",
      align: "end",
      render: (row) => formatQuantity(row.available),
    },
    {
      key: "point",
      header: "Reorder at",
      align: "end",
      render: (row) => formatQuantity(row.reorder_point),
    },
    {
      key: "incoming",
      header: "On order",
      align: "end",
      render: (row) => formatQuantity(row.incoming),
    },
    {
      key: "suggested",
      header: "Order",
      align: "end",
      render: (row) => (
        <span className="font-semibold">{formatQuantity(row.suggested_quantity)}</span>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={data ?? []}
      rowKey={(row) => stockSheetKey(row)}
      onRowClick={(row) => onOpen(stockSheetKey(row))}
      loading={isLoading}
      error={error ? { message: error.message } : null}
      onRetry={() => refetch()}
      empty={
        <p className="p-6 text-center text-sm text-muted-foreground">
          Nothing needs reordering. Set a reorder point on a stock line to have it flagged here.
        </p>
      }
      mobileCardTitle={(row) => row.variant?.product?.name ?? "—"}
      mobileCardFields={[
        {
          key: "suggested",
          label: "Order",
          render: (row) => formatQuantity(row.suggested_quantity),
        },
        { key: "available", label: "Available", render: (row) => formatQuantity(row.available) },
      ]}
    />
  );
}
