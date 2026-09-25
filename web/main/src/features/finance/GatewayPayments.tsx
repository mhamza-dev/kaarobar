"use client";

import Link from "next/link";
import { useState } from "react";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  usePaymentIntents,
  useReconcileSettlement,
  useSettlements,
} from "@/hooks/queries/useFinance";
import { usePermission } from "@/hooks/usePermission";
import { toast } from "@/hooks/useToast";
import { useSheetParam } from "@/hooks/useSheetParam";
import { formatDate, formatDateTime, formatMoney, humanize, isNegative } from "@/lib/format";
import { useSessionStore } from "@/stores/sessionStore";
import type { PaymentIntent, Settlement } from "@/types/api/payments";

import { PaymentSheet } from "./PaymentSheet";

/**
 * Money taken through a gateway, and the payouts that bring it to the bank.
 *
 * A payment stuck on "pending" usually means a webhook never arrived;
 * "Check with gateway" asks the provider directly. Settlements carry the
 * backend's computed `variance` — anything but zero is what a reconcile is
 * for.
 */
export function GatewayPayments() {
  const { can } = usePermission();

  return (
    <Tabs defaultValue="payments">
      <TabsList variant="line">
        <TabsTrigger value="payments">Payments</TabsTrigger>
        <TabsTrigger value="settlements">Settlements</TabsTrigger>
      </TabsList>
      <TabsContent value="payments" className="pt-4">
        <PaymentsTable />
      </TabsContent>
      <TabsContent value="settlements" className="pt-4">
        <SettlementsTable canReconcile={can("payment:reconcile")} />
      </TabsContent>
    </Tabs>
  );
}

function PaymentsTable() {
  const fallbackCurrency = useSessionStore((state) => state.scope?.business?.currency) ?? "PKR";
  const [status, setStatus] = useState("");
  const { data, isLoading, error, refetch } = usePaymentIntents({ status: status || undefined });
  const sheet = useSheetParam();

  const columns: DataTableColumn<PaymentIntent>[] = [
    {
      key: "reference",
      header: "Payment",
      render: (intent) => (
        <div>
          <p className="font-medium">{intent.reference ?? intent.external_id ?? "—"}</p>
          {intent.failure_message && (
            <p className="text-xs text-destructive">{intent.failure_message}</p>
          )}
        </div>
      ),
    },
    {
      key: "when",
      header: "When",
      render: (intent) =>
        formatDateTime(intent.captured_at ?? intent.authorized_at ?? intent.failed_at),
    },
    { key: "status", header: "Status", render: (intent) => <StatusBadge status={intent.status} /> },
    {
      key: "sale",
      header: "Sale",
      render: (intent) =>
        intent.sale_id ? (
          <Link
            href={`/sales/${intent.sale_id}`}
            className="text-brand-primary hover:underline"
            onClick={(event) => event.stopPropagation()}
          >
            View
          </Link>
        ) : (
          "—"
        ),
    },
    {
      key: "amount",
      header: "Amount",
      align: "end",
      render: (intent) => (
        <div>
          <p>{formatMoney(intent.amount, intent.currency ?? fallbackCurrency)}</p>
          {intent.refunded_amount && Number(intent.refunded_amount) > 0 && (
            <p className="text-xs text-muted-foreground">
              −{formatMoney(intent.refunded_amount, intent.currency ?? fallbackCurrency)} refunded
            </p>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <div className="mb-3">
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          aria-label="Filter by status"
          className="h-9 rounded-lg border border-border bg-background px-2 text-sm"
        >
          <option value="">All payments</option>
          {[
            "pending",
            "authorized",
            "captured",
            "partially_refunded",
            "refunded",
            "failed",
            "cancelled",
          ].map((value) => (
            <option key={value} value={value}>
              {humanize(value)}
            </option>
          ))}
        </select>
      </div>
      <DataTable
        columns={columns}
        rows={data ?? []}
        rowKey={(intent) => intent.id}
        onRowClick={(intent) => sheet.open(intent.id)}
        loading={isLoading}
        error={error ? { message: error.message } : null}
        onRetry={() => refetch()}
        empty={
          <p className="p-6 text-center text-sm text-muted-foreground">
            No gateway payments yet. Card and wallet payments taken at the till appear here.
          </p>
        }
        mobileCardTitle={(intent) => intent.reference ?? "Payment"}
        mobileCardSubtitle={(intent) => humanize(intent.status)}
        mobileCardFields={[
          {
            key: "amount",
            label: "Amount",
            render: (intent) => formatMoney(intent.amount, intent.currency ?? fallbackCurrency),
          },
        ]}
      />
      <PaymentSheet intentId={sheet.value} onClose={sheet.close} />
    </>
  );
}

function SettlementsTable({ canReconcile }: { canReconcile: boolean }) {
  const fallbackCurrency = useSessionStore((state) => state.scope?.business?.currency) ?? "PKR";
  const { data, isLoading, error, refetch } = useSettlements();
  const reconcile = useReconcileSettlement();
  const [pending, setPending] = useState<Settlement | null>(null);

  const columns: DataTableColumn<Settlement>[] = [
    {
      key: "period",
      header: "Period",
      render: (settlement) =>
        `${formatDate(settlement.period_start)} – ${formatDate(settlement.period_end)}`,
    },
    {
      key: "count",
      header: "Payments",
      align: "end",
      render: (settlement) => settlement.transaction_count ?? "—",
    },
    {
      key: "gross",
      header: "Gross",
      align: "end",
      render: (settlement) =>
        formatMoney(settlement.gross_amount, settlement.currency ?? fallbackCurrency),
    },
    {
      key: "fees",
      header: "Fees",
      align: "end",
      render: (settlement) =>
        formatMoney(settlement.fee_amount, settlement.currency ?? fallbackCurrency),
    },
    {
      key: "net",
      header: "Paid out",
      align: "end",
      render: (settlement) => (
        <span className="font-medium">
          {formatMoney(settlement.net_amount, settlement.currency ?? fallbackCurrency)}
        </span>
      ),
    },
    {
      key: "variance",
      header: "Variance",
      align: "end",
      render: (settlement) =>
        settlement.variance && Number(settlement.variance) !== 0 ? (
          <span className={isNegative(settlement.variance) ? "text-destructive" : "text-warning"}>
            {formatMoney(settlement.variance, settlement.currency ?? fallbackCurrency)}
          </span>
        ) : (
          "—"
        ),
    },
    {
      key: "status",
      header: "Status",
      render: (settlement) => <StatusBadge status={settlement.status} />,
    },
    {
      key: "actions",
      header: "",
      align: "end",
      width: "w-28",
      render: (settlement) =>
        canReconcile && settlement.status !== "reconciled" ? (
          <Button variant="ghost" size="sm" onClick={() => setPending(settlement)}>
            Reconcile
          </Button>
        ) : null,
    },
  ];

  return (
    <>
      <DataTable
        columns={columns}
        rows={data ?? []}
        rowKey={(settlement) => settlement.id}
        loading={isLoading}
        error={error ? { message: error.message } : null}
        onRetry={() => refetch()}
        empty={
          <p className="p-6 text-center text-sm text-muted-foreground">
            No payouts from a gateway yet.
          </p>
        }
        mobileCardTitle={(settlement) => formatDate(settlement.period_end)}
        mobileCardFields={[
          {
            key: "net",
            label: "Paid out",
            render: (settlement) =>
              formatMoney(settlement.net_amount, settlement.currency ?? fallbackCurrency),
          },
        ]}
      />
      <ConfirmDialog
        open={!!pending}
        onOpenChange={(open) => !open && setPending(null)}
        title="Mark this payout reconciled?"
        description={
          pending?.variance && Number(pending.variance) !== 0
            ? `It differs from its payments by ${formatMoney(pending.variance, pending.currency ?? fallbackCurrency)}. Reconcile only once that's explained.`
            : "It matches the payments it covers."
        }
        confirmLabel="Reconcile"
        loading={reconcile.isPending}
        onConfirm={async () => {
          if (!pending) return;
          try {
            await reconcile.mutateAsync([pending.id]);
            toast.success("Payout reconciled");
            setPending(null);
          } catch {
            // Toasted by the hook.
          }
        }}
      />
    </>
  );
}
