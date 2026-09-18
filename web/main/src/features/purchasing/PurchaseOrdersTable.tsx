"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { DataTable, type DataTableColumn } from "@/components/shared/DataTable/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { usePurchaseOrders } from "@/hooks/queries/usePurchasing";
import { usePermission } from "@/hooks/usePermission";
import { formatDate, formatMoney } from "@/lib/format";
import { useSessionStore } from "@/stores/sessionStore";
import type { PurchaseOrder } from "@/types/api/purchasing";

export function PurchaseOrdersTable() {
  const router = useRouter();
  const { can } = usePermission();
  const currency = useSessionStore((state) => state.scope?.business?.currency) ?? "PKR";
  const [openOnly, setOpenOnly] = useState(false);

  const { rows, isLoading, error, refetch, hasNextPage, isFetchingNextPage, fetchNextPage } =
    usePurchaseOrders({ open: openOnly || undefined });

  const columns: DataTableColumn<PurchaseOrder>[] = [
    {
      key: "number",
      header: "Order",
      render: (order) => <span className="font-medium">{order.number}</span>,
    },
    { key: "supplier", header: "Supplier", render: (order) => order.supplier?.name ?? "—" },
    { key: "status", header: "Status", render: (order) => <StatusBadge status={order.status} /> },
    { key: "ordered", header: "Ordered", render: (order) => formatDate(order.ordered_on) },
    { key: "expected", header: "Expected", render: (order) => formatDate(order.expected_on) },
    {
      key: "total",
      header: "Total",
      align: "end",
      render: (order) => formatMoney(order.total, order.currency ?? currency),
    },
  ];

  return (
    <>
      <div className="mb-3 flex items-center justify-between gap-2">
        <Button
          variant={openOnly ? "default" : "outline"}
          size="sm"
          aria-pressed={openOnly}
          onClick={() => setOpenOnly((value) => !value)}
        >
          Open orders only
        </Button>

        {can("purchase_order:create") && (
          <Button nativeButton={false} render={<Link href="/purchase-orders/new" />}>
            <Plus className="size-4" />
            New purchase order
          </Button>
        )}
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(order) => order.id}
        loading={isLoading}
        error={error ? { message: error.message } : null}
        onRetry={() => refetch()}
        hasMore={hasNextPage}
        loadingMore={isFetchingNextPage}
        onLoadMore={() => fetchNextPage()}
        search={{ getText: (order) => `${order.number} ${order.supplier?.name ?? ""}` }}
        onRowClick={(order) => router.push(`/purchase-orders/${order.id}`)}
        mobileCardTitle={(order) => order.number}
        mobileCardSubtitle={(order) => order.supplier?.name ?? ""}
        mobileCardFields={[
          {
            key: "status",
            label: "Status",
            render: (order) => <StatusBadge status={order.status} />,
          },
          {
            key: "total",
            label: "Total",
            render: (order) => formatMoney(order.total, order.currency ?? currency),
          },
        ]}
      />
    </>
  );
}
