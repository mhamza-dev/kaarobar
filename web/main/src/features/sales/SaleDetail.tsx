"use client";

import { useState } from "react";

import { DataTable, type DataTableColumn } from "@/components/shared/DataTable/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import {
  WorkflowActions,
  type WorkflowAction,
} from "@/components/shared/WorkflowActions/WorkflowActions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useSale, useVoidSale } from "@/hooks/queries/useSales";
import { usePermission } from "@/hooks/usePermission";
import { toast } from "@/hooks/useToast";
import { formatDateTime, formatMoney, formatQuantity } from "@/lib/format";
import type { SaleItem } from "@/types/api/sales";

/**
 * A completed sale, for review and for undoing.
 *
 * Void and refund are different remedies and the backend treats them as
 * such: voiding reverses the whole sale (and is usually same-day), while a
 * refund returns part of it against specific lines. `refundable_amount`
 * comes from the server, so a sale already fully refunded offers nothing.
 */
export function SaleDetail({ saleId }: { saleId: string }) {
  const { can } = usePermission();
  const { data: sale, isLoading, isError } = useSale(saleId);
  const voidSale = useVoidSale();
  const [reason, setReason] = useState("");

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (isError || !sale) {
    return <p className="text-sm text-muted-foreground">We couldn&apos;t load this sale.</p>;
  }

  const actions: WorkflowAction[] = [
    {
      key: "void",
      label: "Void sale",
      variant: "destructive",
      available: sale.status === "completed",
      permitted: can("sale:void"),
      pending: voidSale.isPending,
      confirm: {
        title: `Void ${sale.number}?`,
        description: (
          <div className="flex flex-col gap-2">
            <span>
              This reverses the whole sale — stock goes back and the takings are reduced by{" "}
              {formatMoney(sale.total, sale.currency)}.
            </span>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="void-reason">Reason</Label>
              <Input
                id="void-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="e.g. Rung up twice"
              />
            </div>
          </div>
        ),
        confirmLabel: "Void",
        destructive: true,
      },
      onAction: async () => {
        if (!reason.trim()) {
          toast.error("A reason is required to void a sale");
          return;
        }
        await voidSale.mutateAsync([sale.id, reason]);
        toast.success("Sale voided");
        setReason("");
      },
    },
  ];

  const columns: DataTableColumn<SaleItem>[] = [
    { key: "name", header: "Item", render: (item) => item.name },
    {
      key: "quantity",
      header: "Qty",
      align: "end",
      render: (item) => formatQuantity(item.quantity),
    },
    {
      key: "unit_price",
      header: "Unit",
      align: "end",
      render: (item) => formatMoney(item.unit_price, sale.currency),
    },
    {
      key: "tax",
      header: "Tax",
      align: "end",
      render: (item) => formatMoney(item.tax_total, sale.currency),
    },
    {
      key: "total",
      header: "Total",
      align: "end",
      render: (item) => formatMoney(item.line_total, sale.currency),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <StatusBadge status={sale.status} />
          <dl className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
            <Field label="Sold" value={formatDateTime(sale.sold_at)} />
            <Field label="Cashier" value={sale.cashier_label ?? "—"} />
            <Field label="Total" value={formatMoney(sale.total, sale.currency)} />
            <Field label="Refundable" value={formatMoney(sale.refundable_amount, sale.currency)} />
          </dl>
          {sale.void_reason && (
            <p className="text-sm text-destructive">Voided: {sale.void_reason}</p>
          )}
        </div>

        <WorkflowActions actions={actions} />
      </div>

      <DataTable
        columns={columns}
        rows={sale.items ?? []}
        rowKey={(item) => item.id}
        mobileCardTitle={(item) => item.name}
        mobileCardFields={[
          { key: "qty", label: "Qty", render: (item) => formatQuantity(item.quantity) },
          {
            key: "total",
            label: "Total",
            render: (item) => formatMoney(item.line_total, sale.currency),
          },
        ]}
      />

      {(sale.payments ?? []).length > 0 && (
        <div className="rounded-xl border border-border p-3">
          <p className="mb-2 text-sm font-medium">Payments</p>
          {(sale.payments ?? []).map((payment) => (
            <div key={payment.id} className="flex justify-between py-0.5 text-sm">
              <span className="text-muted-foreground">{payment.method}</span>
              <span className="tabular-nums">{formatMoney(payment.amount, sale.currency)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
