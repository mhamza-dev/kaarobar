"use client";

import { ChevronRight, ReceiptText, WalletCards } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { DescriptionList } from "@/components/shared/DescriptionList";
import { RefundDialog } from "@/features/sales/RefundDialog";
import { SaleReturnsTable } from "@/features/sales/SaleReturnsTable";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable/DataTable";
import { DocumentPreview } from "@/components/shared/DocumentPreview";
import { PageActions } from "@/components/shared/PageActions";
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
import { paymentMethodLabel } from "@/lib/paymentMethods";
import { getReceiptHtml } from "@/services/reports";
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
  const [showingReceipt, setShowingReceipt] = useState(false);
  const [refunding, setRefunding] = useState(false);

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
      key: "receipt",
      label: "Receipt",
      available: true,
      permitted: can("sale:reprint"),
      onAction: () => setShowingReceipt(true),
    },
    {
      key: "refund",
      label: "Refund items",
      available:
        ["completed", "partially_refunded"].includes(sale.status) &&
        (sale.items ?? []).some((item) => Number(item.refundable_quantity) > 0),
      permitted: can("sale:refund_request"),
      onAction: () => setRefunding(true),
    },
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

  const money = (value: string | null | undefined) => formatMoney(value, sale.currency);
  const refunded = Number(sale.refunded_total ?? 0) > 0;

  return (
    <div className="flex flex-col gap-6">
      <PageActions>
        <WorkflowActions actions={actions} />
      </PageActions>

      <section className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4 rounded-xl border border-border bg-card p-5 shadow-card md:p-6">
        <div className="flex min-w-0 items-center gap-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
            <ReceiptText className="size-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-semibold tracking-tight md:text-2xl">{sale.number}</h2>
              <StatusBadge status={sale.status} />
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {formatDateTime(sale.sold_at)}
              {sale.cashier_label && ` · rung up by ${sale.cashier_label}`}
              {sale.register?.name && ` · ${sale.register.name}`}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs font-medium text-muted-foreground">Total</p>
          <p className="text-3xl font-semibold tracking-tight tabular-nums">{money(sale.total)}</p>
        </div>
        {sale.void_reason && (
          <p className="w-full rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
            Voided{sale.voided_at && ` ${formatDateTime(sale.voided_at)}`}: {sale.void_reason}
          </p>
        )}
      </section>

      <div className="grid items-start gap-6 lg:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-6 lg:col-span-2">
          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold">
              Items{" "}
              <span className="font-normal text-muted-foreground">
                · {(sale.items ?? []).length}
              </span>
            </h2>
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
                  render: (item) => money(item.line_total),
                },
              ]}
            />
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold">Returns</h2>
            <div className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
              <SaleReturnsTable saleId={sale.id} embedded />
            </div>
          </section>
        </div>

        <aside className="flex flex-col gap-4">
          <div className="rounded-xl border border-border bg-card p-5 shadow-card">
            <h2 className="mb-2 text-sm font-semibold">Summary</h2>
            <DescriptionList
              items={[
                { label: "Subtotal", value: money(sale.subtotal) },
                {
                  label: "Discounts",
                  value: `-${money(sale.discount_total)}`,
                  hidden: !Number(sale.discount_total ?? 0),
                },
                { label: "Tax", value: money(sale.tax_total) },
                {
                  label: "Rounding",
                  value: money(sale.rounding),
                  hidden: !Number(sale.rounding ?? 0),
                },
                {
                  label: "Total",
                  value: <span className="font-semibold">{money(sale.total)}</span>,
                },
                { label: "Paid", value: money(sale.paid_total) },
                {
                  label: "Change given",
                  value: money(sale.change_due),
                  hidden: !Number(sale.change_due ?? 0),
                },
                {
                  label: "Refunded",
                  value: <span className="text-danger">{money(sale.refunded_total)}</span>,
                  hidden: !refunded,
                },
                {
                  label: "Still refundable",
                  value: money(sale.refundable_amount),
                  hidden: !refunded && sale.status !== "completed",
                },
                {
                  label: "Profit",
                  value: money(sale.margin),
                  hidden: !can("report:financial") || sale.margin === null,
                },
              ]}
            />
          </div>

          {(sale.payments ?? []).length > 0 && (
            <div className="rounded-xl border border-border bg-card p-5 shadow-card">
              <h2 className="mb-3 text-sm font-semibold">Payments</h2>
              <ul className="flex flex-col gap-2.5">
                {(sale.payments ?? []).map((payment) => (
                  <li key={payment.id} className="flex items-center gap-3 text-sm">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                      <WalletCards className="size-4" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">
                        {paymentMethodLabel(payment.method)}
                        {payment.card_last_four && ` ···· ${payment.card_last_four}`}
                      </span>
                      {(payment.tendered_amount || payment.reference) && (
                        <span className="block truncate text-xs text-muted-foreground">
                          {payment.tendered_amount
                            ? `${money(payment.tendered_amount)} given`
                            : payment.reference}
                        </span>
                      )}
                    </span>
                    <span className="font-medium tabular-nums">{money(payment.amount)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {sale.customer && (
            <Link
              href={`/customers/${sale.customer.id}`}
              className="group flex items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-card transition-colors hover:border-primary/40"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                {sale.customer.name.slice(0, 1).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-xs text-muted-foreground">Customer</span>
                <span className="block truncate text-sm font-medium">{sale.customer.name}</span>
              </span>
              <ChevronRight
                className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                aria-hidden
              />
            </Link>
          )}

          {(sale.notes || sale.discount_reason || sale.fiscal_number) && (
            <div className="rounded-xl border border-border bg-card p-5 shadow-card">
              <DescriptionList
                items={[
                  { label: "Note", value: sale.notes, hidden: !sale.notes },
                  {
                    label: "Discount reason",
                    value: sale.discount_reason,
                    hidden: !sale.discount_reason,
                  },
                  {
                    label: "Fiscal number",
                    value: sale.fiscal_number,
                    hidden: !sale.fiscal_number,
                  },
                ]}
              />
            </div>
          )}
        </aside>
      </div>

      <RefundDialog sale={sale} open={refunding} onOpenChange={setRefunding} />

      <DocumentPreview
        open={showingReceipt}
        onOpenChange={setShowingReceipt}
        title={`Receipt ${sale.number}`}
        description="A reprint, exactly as the backend renders it."
        queryKey={["receipt", sale.id]}
        fetchHtml={(paper) => getReceiptHtml(sale.id, { paper })}
        papers={["80mm", "76mm", "58mm", "A4"]}
        defaultPaper="80mm"
      />
    </div>
  );
}
