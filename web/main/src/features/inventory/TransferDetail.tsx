"use client";

import { AlertTriangle, ArrowRight } from "lucide-react";
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
  useCancelTransfer,
  useDispatchTransfer,
  useReceiveTransfer,
  useTransfer,
} from "@/hooks/queries/useStockOperations";
import { usePermission } from "@/hooks/usePermission";
import { toast } from "@/hooks/useToast";
import { formatDateTime, formatQuantity } from "@/lib/format";
import type { TransferItem } from "@/types/api/inventory";

/**
 * A transfer through its lifecycle: draft → dispatched → received.
 *
 * The three transitions are three permissions on purpose — stock must not
 * leave a branch on one person's say-so — so the action bar is built from
 * `WorkflowActions`, which hides anything the status or the caller's
 * permissions rule out.
 */
export function TransferDetail({ transferId }: { transferId: string }) {
  const router = useRouter();
  const { can } = usePermission();
  const { data: transfer, isLoading, isError } = useTransfer(transferId);

  const dispatch = useDispatchTransfer(transferId);
  const receive = useReceiveTransfer(transferId);
  const cancel = useCancelTransfer(transferId);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (isError || !transfer) {
    return <p className="text-sm text-muted-foreground">We couldn&apos;t load this transfer.</p>;
  }

  const isDraft = transfer.status === "draft";
  const isDispatched = transfer.status === "dispatched";

  const actions: WorkflowAction[] = [
    {
      key: "dispatch",
      label: "Dispatch",
      variant: "default",
      available: isDraft,
      permitted: can("stock:transfer_approve"),
      pending: dispatch.isPending,
      confirm: {
        title: `Dispatch ${transfer.number}?`,
        description: `Stock leaves ${transfer.source_branch?.name} now. It won't reach ${transfer.destination_branch?.name} until someone receives it.`,
        confirmLabel: "Dispatch",
      },
      onAction: async () => {
        await dispatch.mutateAsync([transfer.id]);
        toast.success("Transfer dispatched");
      },
    },
    {
      key: "receive",
      label: "Receive",
      variant: "default",
      available: isDispatched,
      permitted: can("stock:receive"),
      pending: receive.isPending,
      confirm: {
        title: `Receive ${transfer.number}?`,
        description: `This adds the full sent quantity into ${transfer.destination_branch?.name}. Record a short delivery through a stock count if less arrived.`,
        confirmLabel: "Receive",
      },
      onAction: async () => {
        await receive.mutateAsync([transfer.id, {}]);
        toast.success("Transfer received");
      },
    },
    {
      key: "cancel",
      label: "Cancel",
      variant: "destructive",
      available: isDraft || isDispatched,
      permitted: can("stock:transfer_approve"),
      pending: cancel.isPending,
      confirm: {
        title: `Cancel ${transfer.number}?`,
        description: "Any stock already dispatched is returned to the source branch.",
        confirmLabel: "Cancel transfer",
        destructive: true,
      },
      onAction: async () => {
        await cancel.mutateAsync([transfer.id]);
        toast.success("Transfer cancelled");
        router.push("/stock-transfers");
      },
    },
  ];

  const columns: DataTableColumn<TransferItem>[] = [
    {
      key: "product",
      header: "Product",
      render: (item) => item.variant?.product?.name ?? item.variant?.name ?? "—",
    },
    { key: "sku", header: "SKU", render: (item) => item.variant?.sku ?? "—" },
    {
      key: "quantity",
      header: "Sent",
      align: "end",
      render: (item) => formatQuantity(item.quantity),
    },
    {
      key: "received",
      header: "Received",
      align: "end",
      render: (item) => formatQuantity(item.received_quantity),
    },
    {
      key: "shortfall",
      header: "Short",
      align: "end",
      render: (item) =>
        item.short ? (
          <span className="flex items-center justify-end gap-1 text-destructive">
            <AlertTriangle className="size-3.5" />
            {formatQuantity(item.shortfall)}
          </span>
        ) : (
          "—"
        ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <StatusBadge status={transfer.status} />
            {transfer.in_transit && <Badge variant="outline">In transit</Badge>}
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span>{transfer.source_branch?.name}</span>
            <ArrowRight className="size-4 text-muted-foreground" />
            <span>{transfer.destination_branch?.name}</span>
          </div>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-muted-foreground">
            <div>
              <dt className="inline">Dispatched: </dt>
              <dd className="inline">{formatDateTime(transfer.dispatched_at)}</dd>
            </div>
            <div>
              <dt className="inline">Received: </dt>
              <dd className="inline">{formatDateTime(transfer.received_at)}</dd>
            </div>
          </dl>
        </div>

        <WorkflowActions actions={actions} />
      </div>

      {transfer.notes && (
        <p className="rounded-lg border border-border bg-muted/40 p-3 text-sm">{transfer.notes}</p>
      )}

      <DataTable
        columns={columns}
        rows={transfer.items ?? []}
        rowKey={(item) => item.id}
        mobileCardTitle={(item) => item.variant?.product?.name ?? "—"}
        mobileCardFields={[
          { key: "qty", label: "Sent", render: (item) => formatQuantity(item.quantity) },
        ]}
      />
    </div>
  );
}
