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
import { usePostSupplierBill, useSupplierBill } from "@/hooks/queries/usePurchasing";
import { usePermission } from "@/hooks/usePermission";
import { toast } from "@/hooks/useToast";
import { formatDate, formatMoney, formatQuantity } from "@/lib/format";
import type { SupplierBillItem } from "@/types/api/purchasing";

import { SupplierPaymentDialog } from "./SupplierPaymentDialog";

/**
 * A supplier's invoice as entered: draft until posted, then owed until paid.
 *
 * Posting is the point the amount lands on the supplier's account; payments
 * can only be matched to a bill after that, which is why "Record payment"
 * appears only once there is something outstanding on a posted bill.
 */
export function SupplierBillDetail({ billId }: { billId: string }) {
  const { can } = usePermission();
  const { data: bill, isLoading, isError, refetch } = useSupplierBill(billId);
  const post = usePostSupplierBill();

  if (isLoading) return <DetailSkeleton />;
  if (isError || !bill) return <LoadError what="this bill" onRetry={() => refetch()} />;

  const currency = bill.currency ?? "PKR";
  const payable =
    ["posted", "partially_paid"].includes(bill.status) && Number(bill.outstanding) > 0;

  const actions: WorkflowAction[] = [
    {
      key: "post",
      label: "Post bill",
      variant: "default",
      available: bill.status === "draft",
      permitted: can("supplier_bill:manage"),
      pending: post.isPending,
      confirm: {
        title: `Post ${bill.number}?`,
        description: `${formatMoney(bill.total, currency)} is added to what you owe ${bill.supplier?.name ?? "the supplier"}. A posted bill can't be edited.`,
        confirmLabel: "Post bill",
      },
      onAction: async () => {
        await post.mutateAsync([bill.id]);
        toast.success(`${bill.number} posted`);
      },
    },
  ];

  const columns: DataTableColumn<SupplierBillItem>[] = [
    { key: "description", header: "Description", render: (item) => item.description ?? "—" },
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
      key: "tax",
      header: "Tax",
      align: "end",
      render: (item) => formatMoney(item.tax_total, currency, { showZero: false }),
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
          <div className="flex items-center gap-2">
            <StatusBadge status={bill.status} />
            {bill.overdue && <Badge variant="destructive">Overdue</Badge>}
          </div>
          <DescriptionList
            layout="inline"
            items={[
              { label: "Supplier", value: bill.supplier?.name },
              { label: "Their invoice", value: bill.supplier_invoice_number },
              { label: "Dated", value: formatDate(bill.issued_on) },
              { label: "Due", value: formatDate(bill.due_on) },
              {
                label: "Goods receipt",
                hidden: !bill.goods_receipt_id,
                value: (
                  <Link
                    href={`/goods-receipts/${bill.goods_receipt_id}`}
                    className="text-brand-primary underline-offset-2 hover:underline"
                  >
                    View receipt
                  </Link>
                ),
              },
            ]}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {payable && can("supplier_payment:record") && <SupplierPaymentDialog bill={bill} />}
          <WorkflowActions actions={actions} />
        </div>
      </div>

      {bill.notes && (
        <p className="rounded-lg border border-border bg-muted/40 p-3 text-sm">{bill.notes}</p>
      )}

      <DataTable
        columns={columns}
        rows={bill.items ?? []}
        rowKey={(item) => item.id}
        mobileCardTitle={(item) => item.description ?? "—"}
        mobileCardFields={[
          { key: "qty", label: "Qty", render: (item) => formatQuantity(item.quantity) },
          {
            key: "total",
            label: "Total",
            render: (item) => formatMoney(item.line_total, currency),
          },
        ]}
      />

      <dl className="ml-auto flex w-full max-w-xs flex-col gap-1 text-sm">
        {[
          ["Subtotal", bill.subtotal],
          ["Tax", bill.tax_total],
          ["Total", bill.total],
          ["Paid", bill.paid_total],
        ].map(([label, value]) => (
          <div key={label} className="flex justify-between">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="tabular-nums">{formatMoney(value, currency)}</dd>
          </div>
        ))}
        <div className="flex justify-between border-t border-border pt-1 font-semibold">
          <dt>Outstanding</dt>
          <dd className="tabular-nums">{formatMoney(bill.outstanding, currency)}</dd>
        </div>
      </dl>
    </div>
  );
}
