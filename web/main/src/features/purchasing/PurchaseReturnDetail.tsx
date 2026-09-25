"use client";

import { DataTable, type DataTableColumn } from "@/components/shared/DataTable/DataTable";
import { DescriptionList } from "@/components/shared/DescriptionList";
import { DetailSkeleton } from "@/components/shared/DetailSkeleton";
import { LoadError } from "@/components/shared/LoadError";
import { StatusBadge } from "@/components/shared/StatusBadge";
import {
  WorkflowActions,
  type WorkflowAction,
} from "@/components/shared/WorkflowActions/WorkflowActions";
import { usePostPurchaseReturn, usePurchaseReturn } from "@/hooks/queries/usePurchasing";
import { usePermission } from "@/hooks/usePermission";
import { toast } from "@/hooks/useToast";
import { formatDate, formatMoney, formatQuantity } from "@/lib/format";
import { useSessionStore } from "@/stores/sessionStore";
import type { PurchaseReturnItem } from "@/types/api/purchasing";

/** Goods going back to a supplier: a draft until posted takes them out of stock. */
export function PurchaseReturnDetail({ returnId }: { returnId: string }) {
  const { can } = usePermission();
  const currency = useSessionStore((state) => state.scope?.business?.currency) ?? "PKR";
  const { data: record, isLoading, isError, refetch } = usePurchaseReturn(returnId);
  const post = usePostPurchaseReturn();

  if (isLoading) return <DetailSkeleton />;
  if (isError || !record) return <LoadError what="this return" onRetry={() => refetch()} />;

  const actions: WorkflowAction[] = [
    {
      key: "post",
      label: "Post return",
      variant: "default",
      available: record.status === "draft",
      permitted: can("purchase_return:manage"),
      pending: post.isPending,
      confirm: {
        title: `Post ${record.number}?`,
        description: `The goods come out of stock and ${formatMoney(record.total, currency)} is credited to ${record.supplier?.name ?? "the supplier"}. This can't be undone.`,
        confirmLabel: "Post return",
      },
      onAction: async () => {
        await post.mutateAsync([record.id]);
        toast.success(`${record.number} posted`);
      },
    },
  ];

  const columns: DataTableColumn<PurchaseReturnItem>[] = [
    {
      key: "product",
      header: "Product",
      render: (item) => item.variant?.product?.name ?? item.variant?.name ?? "—",
    },
    { key: "note", header: "Note", render: (item) => item.note ?? "—" },
    {
      key: "qty",
      header: "Qty",
      align: "end",
      render: (item) => formatQuantity(item.quantity),
    },
    {
      key: "cost",
      header: "Unit cost",
      align: "end",
      render: (item) => formatMoney(item.unit_cost, currency),
    },
    {
      key: "total",
      header: "Total",
      align: "end",
      render: (item) => formatMoney(item.line_total, currency),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <StatusBadge status={record.status} />
          <DescriptionList
            layout="inline"
            items={[
              { label: "Supplier", value: record.supplier?.name },
              { label: "Returned on", value: formatDate(record.returned_on) },
              { label: "Reason", value: record.reason },
              {
                label: "Total",
                value: <span className="font-medium">{formatMoney(record.total, currency)}</span>,
              },
            ]}
          />
        </div>
        <WorkflowActions actions={actions} />
      </div>

      {record.notes && (
        <p className="rounded-lg border border-border bg-muted/40 p-3 text-sm">{record.notes}</p>
      )}

      <DataTable
        columns={columns}
        rows={record.items ?? []}
        rowKey={(item) => item.id}
        mobileCardTitle={(item) => item.variant?.product?.name ?? "—"}
        mobileCardFields={[
          { key: "qty", label: "Qty", render: (item) => formatQuantity(item.quantity) },
          {
            key: "total",
            label: "Total",
            render: (item) => formatMoney(item.line_total, currency),
          },
        ]}
      />
    </div>
  );
}
