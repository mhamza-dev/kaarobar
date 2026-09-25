"use client";

import Link from "next/link";

import { DataTable, type DataTableColumn } from "@/components/shared/DataTable/DataTable";
import { DescriptionList } from "@/components/shared/DescriptionList";
import { DetailSkeleton } from "@/components/shared/DetailSkeleton";
import { LoadError } from "@/components/shared/LoadError";
import { StatusBadge } from "@/components/shared/StatusBadge";
import {
  WorkflowActions,
  type WorkflowAction,
} from "@/components/shared/WorkflowActions/WorkflowActions";
import { Badge } from "@/components/ui/badge";
import { useGoodsReceipt, usePostGoodsReceipt } from "@/hooks/queries/usePurchasing";
import { usePermission } from "@/hooks/usePermission";
import { toast } from "@/hooks/useToast";
import { formatDate, formatDateTime, formatMoney, formatQuantity } from "@/lib/format";
import { useSessionStore } from "@/stores/sessionStore";
import type { GoodsReceiptItem } from "@/types/api/purchasing";

import { SupplierBillDialog } from "./SupplierBillDialog";

/**
 * A delivery, line by line: what arrived, what was rejected, which batch it
 * went into. A draft receipt is a delivery nobody has confirmed yet —
 * posting it is what puts the goods into stock.
 */
export function GoodsReceiptDetail({ receiptId }: { receiptId: string }) {
  const { can } = usePermission();
  const fallbackCurrency = useSessionStore((state) => state.scope?.business?.currency) ?? "PKR";
  const { data: receipt, isLoading, isError, refetch } = useGoodsReceipt(receiptId);
  const post = usePostGoodsReceipt();

  if (isLoading) return <DetailSkeleton />;
  if (isError || !receipt) {
    return <LoadError what="this goods receipt" onRetry={() => refetch()} />;
  }

  const currency = receipt.purchase_order?.currency ?? fallbackCurrency;

  const actions: WorkflowAction[] = [
    {
      key: "post",
      label: "Post to stock",
      variant: "default",
      available: receipt.status === "draft",
      permitted: can("purchase_order:receive"),
      pending: post.isPending,
      confirm: {
        title: `Post ${receipt.number}?`,
        description:
          "The accepted quantities go into stock at their unit cost, rejected goods are written off, and the order is updated. This can't be undone.",
        confirmLabel: "Post",
      },
      onAction: async () => {
        await post.mutateAsync([receipt.id]);
        toast.success(`${receipt.number} posted to stock`);
      },
    },
  ];

  const columns: DataTableColumn<GoodsReceiptItem>[] = [
    {
      key: "product",
      header: "Product",
      render: (item) => item.variant?.product?.name ?? item.variant?.name ?? "—",
    },
    {
      key: "batch",
      header: "Batch",
      render: (item) =>
        item.batch_number ? (
          <div>
            <p>{item.batch_number}</p>
            {item.expires_on && (
              <p className="text-xs text-muted-foreground">Expires {formatDate(item.expires_on)}</p>
            )}
          </div>
        ) : (
          "—"
        ),
    },
    {
      key: "received",
      header: "Received",
      align: "end",
      render: (item) => formatQuantity(item.quantity),
    },
    {
      key: "rejected",
      header: "Rejected",
      align: "end",
      render: (item) =>
        Number(item.rejected_quantity) > 0 ? (
          <span className="text-destructive">{formatQuantity(item.rejected_quantity)}</span>
        ) : (
          "—"
        ),
    },
    {
      key: "cost",
      header: "Unit cost",
      align: "end",
      render: (item) => formatMoney(item.unit_cost, currency),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <StatusBadge status={receipt.status} />
            {!receipt.posted && receipt.status !== "cancelled" && (
              <Badge variant="outline">Not in stock yet</Badge>
            )}
          </div>
          <DescriptionList
            layout="inline"
            items={[
              { label: "Supplier", value: receipt.supplier?.name },
              {
                label: "Against order",
                value: receipt.purchase_order ? (
                  <Link
                    href={`/purchase-orders/${receipt.purchase_order.id}`}
                    className="text-brand-primary underline-offset-2 hover:underline"
                  >
                    {receipt.purchase_order.number}
                  </Link>
                ) : (
                  "No order"
                ),
              },
              { label: "Received on", value: formatDate(receipt.received_on) },
              { label: "Supplier ref.", value: receipt.supplier_reference },
              {
                label: "Posted",
                value: formatDateTime(receipt.posted_at),
                hidden: !receipt.posted,
              },
              {
                label: "Total",
                value: <span className="font-medium">{formatMoney(receipt.total, currency)}</span>,
              },
            ]}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {receipt.posted && can("supplier_bill:manage") && (
            <SupplierBillDialog fromReceipt={receipt} />
          )}
          <WorkflowActions actions={actions} />
        </div>
      </div>

      {receipt.notes && (
        <p className="rounded-lg border border-border bg-muted/40 p-3 text-sm">{receipt.notes}</p>
      )}

      <DataTable
        columns={columns}
        rows={receipt.items ?? []}
        rowKey={(item) => item.id}
        mobileCardTitle={(item) => item.variant?.product?.name ?? "—"}
        mobileCardSubtitle={(item) => item.batch_number ?? ""}
        mobileCardFields={[
          { key: "qty", label: "Received", render: (item) => formatQuantity(item.quantity) },
          {
            key: "cost",
            label: "Unit cost",
            render: (item) => formatMoney(item.unit_cost, currency),
          },
        ]}
      />
    </div>
  );
}
