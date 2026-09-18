"use client";

import { useRouter } from "next/navigation";

import { DataTable, type DataTableColumn } from "@/components/shared/DataTable/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import {
  WorkflowActions,
  type WorkflowAction,
} from "@/components/shared/WorkflowActions/WorkflowActions";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useApprovePurchaseOrder,
  useCancelPurchaseOrder,
  useClosePurchaseOrder,
  usePurchaseOrder,
} from "@/hooks/queries/usePurchasing";
import { usePermission } from "@/hooks/usePermission";
import { toast } from "@/hooks/useToast";
import { formatDate, formatMoney, formatQuantity } from "@/lib/format";
import { useSessionStore } from "@/stores/sessionStore";
import type { PurchaseOrderItem } from "@/types/api/purchasing";

import { GoodsReceiptDialog } from "./GoodsReceiptDialog";

/**
 * A purchase order and its lifecycle.
 *
 * Availability comes from the server-computed `receivable`/`editable`
 * booleans rather than re-deriving the status machine here — the backend
 * owns those rules, and a second copy on the client is a second copy to
 * drift.
 */
export function PurchaseOrderDetail({ orderId }: { orderId: string }) {
  const router = useRouter();
  const { can } = usePermission();
  const fallbackCurrency = useSessionStore((state) => state.scope?.business?.currency) ?? "PKR";

  const { data: order, isLoading, isError } = usePurchaseOrder(orderId);
  const approve = useApprovePurchaseOrder(orderId);
  const cancel = useCancelPurchaseOrder(orderId);
  const close = useClosePurchaseOrder(orderId);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (isError || !order) {
    return <p className="text-sm text-muted-foreground">We couldn&apos;t load this order.</p>;
  }

  const currency = order.currency ?? fallbackCurrency;

  const actions: WorkflowAction[] = [
    {
      key: "approve",
      label: "Approve and send",
      variant: "default",
      // A PO reaches approval from either draft or awaiting_approval
      // (Purchasing.PurchaseOrder @statuses); gating on "draft" alone would
      // strand every order held for sign-off.
      available: order.status === "draft" || order.status === "awaiting_approval",
      permitted: can("purchase_order:approve"),
      pending: approve.isPending,
      confirm: {
        title: `Approve ${order.number}?`,
        description: `This commits ${formatMoney(order.total, currency)} to ${
          order.supplier?.name ?? "the supplier"
        }.`,
        confirmLabel: "Approve",
      },
      onAction: async () => {
        await approve.mutateAsync([order.id]);
        toast.success("Purchase order approved");
      },
    },
    {
      key: "close",
      label: "Close order",
      available: order.receivable,
      permitted: can("purchase_order:edit"),
      pending: close.isPending,
      confirm: {
        title: `Close ${order.number}?`,
        description: "Outstanding quantities are written off — nothing further can be received.",
        confirmLabel: "Close",
      },
      onAction: async () => {
        await close.mutateAsync([order.id]);
        toast.success("Purchase order closed");
      },
    },
    {
      key: "cancel",
      label: "Cancel",
      variant: "destructive",
      available: order.status !== "cancelled" && order.status !== "received",
      permitted: can("purchase_order:cancel"),
      pending: cancel.isPending,
      confirm: {
        title: `Cancel ${order.number}?`,
        description: "The order is voided. Anything already received stays in stock.",
        confirmLabel: "Cancel order",
        destructive: true,
      },
      onAction: async () => {
        await cancel.mutateAsync([order.id]);
        toast.success("Purchase order cancelled");
        router.push("/purchase-orders");
      },
    },
  ];

  const columns: DataTableColumn<PurchaseOrderItem>[] = [
    {
      key: "product",
      header: "Product",
      render: (item) => item.variant?.product?.name ?? item.description ?? "—",
    },
    {
      key: "ordered",
      header: "Ordered",
      align: "end",
      render: (item) => formatQuantity(item.ordered_quantity),
    },
    {
      key: "received",
      header: "Received",
      align: "end",
      render: (item) => (
        <span className="flex items-center justify-end gap-1.5">
          {formatQuantity(item.received_quantity)}
          {item.fully_received && <Badge variant="secondary">Complete</Badge>}
        </span>
      ),
    },
    {
      key: "outstanding",
      header: "Outstanding",
      align: "end",
      render: (item) => formatQuantity(item.outstanding_quantity),
    },
    {
      key: "unit_cost",
      header: "Unit cost",
      align: "end",
      render: (item) => formatMoney(item.unit_cost, currency),
    },
    {
      key: "line_total",
      header: "Total",
      align: "end",
      render: (item) => formatMoney(item.line_total, currency),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <StatusBadge status={order.status} />
          <dl className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">Supplier</dt>
              <dd>{order.supplier?.name ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Branch</dt>
              <dd>{order.branch?.name ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Expected</dt>
              <dd>{formatDate(order.expected_on)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Total</dt>
              <dd className="font-medium">{formatMoney(order.total, currency)}</dd>
            </div>
          </dl>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {order.receivable && can("purchase_order:receive") && (
            <GoodsReceiptDialog order={order} />
          )}
          <WorkflowActions actions={actions} />
        </div>
      </div>

      <DataTable
        columns={columns}
        rows={order.items ?? []}
        rowKey={(item) => item.id}
        mobileCardTitle={(item) => item.variant?.product?.name ?? item.description ?? "—"}
        mobileCardFields={[
          {
            key: "ordered",
            label: "Ordered",
            render: (item) => formatQuantity(item.ordered_quantity),
          },
          {
            key: "outstanding",
            label: "Outstanding",
            render: (item) => formatQuantity(item.outstanding_quantity),
          },
        ]}
      />
    </div>
  );
}
