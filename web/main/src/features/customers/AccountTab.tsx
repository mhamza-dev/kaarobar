"use client";

import { FileText } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { DataTable, type DataTableColumn } from "@/components/shared/DataTable/DataTable";
import { DocumentPreview } from "@/components/shared/DocumentPreview";
import { Button } from "@/components/ui/button";
import {
  useCustomerLedger,
  useCustomerPayments,
  useOpenInvoices,
  useStoreCredit,
} from "@/hooks/queries/useCustomers";
import { usePermission } from "@/hooks/usePermission";
import { formatDate, formatDateTime, formatMoney, humanize } from "@/lib/format";
import { getStatementHtml } from "@/services/reports";
import type {
  CreditInvoice,
  CustomerLedgerEntry,
  CustomerPayment,
  StoreCredit,
} from "@/types/api/crm";

import { AllocatePaymentDialog } from "./AllocatePaymentDialog";
import { IssueStoreCreditDialog, StoreCreditSheet } from "./StoreCredit";

/**
 * A customer's money: what is still unpaid, every entry that moved the
 * balance, the payments they have made and any store credit they hold.
 *
 * Mounted only for callers with `credit:view` — the same gate the backend
 * puts on the ledger and payments endpoints.
 */
export function AccountTab({ customerId, currency }: { customerId: string; currency: string }) {
  const invoices = useOpenInvoices(customerId);
  const ledger = useCustomerLedger(customerId);
  const payments = useCustomerPayments(customerId);
  const storeCredit = useStoreCredit(customerId);
  const [showingStatement, setShowingStatement] = useState(false);
  const [allocating, setAllocating] = useState<CustomerPayment | null>(null);
  const [viewingCredit, setViewingCredit] = useState<string | null>(null);
  const { can } = usePermission();

  const invoiceColumns: DataTableColumn<CreditInvoice>[] = [
    {
      key: "number",
      header: "Invoice",
      render: (invoice) => (
        <Link
          href={`/sales/${invoice.sale_id}`}
          className="font-medium text-brand-primary hover:underline"
          onClick={(event) => event.stopPropagation()}
        >
          {invoice.number}
        </Link>
      ),
    },
    { key: "sold", header: "Sold", render: (invoice) => formatDate(invoice.sold_at) },
    { key: "due", header: "Due", render: (invoice) => formatDate(invoice.due_on) },
    {
      key: "late",
      header: "Late",
      align: "end",
      render: (invoice) =>
        invoice.days_overdue && invoice.days_overdue > 0 ? (
          <span className="text-destructive">{invoice.days_overdue} days</span>
        ) : (
          "—"
        ),
    },
    {
      key: "outstanding",
      header: "Outstanding",
      align: "end",
      render: (invoice) => formatMoney(invoice.outstanding, currency),
    },
  ];

  const ledgerColumns: DataTableColumn<CustomerLedgerEntry>[] = [
    { key: "when", header: "When", render: (entry) => formatDateTime(entry.occurred_at) },
    { key: "kind", header: "Entry", render: (entry) => humanize(entry.kind) },
    {
      key: "note",
      header: "Note",
      render: (entry) => entry.note ?? entry.actor_label ?? "—",
    },
    {
      key: "amount",
      header: "Amount",
      align: "end",
      render: (entry) => formatMoney(entry.amount, currency),
    },
    {
      key: "balance",
      header: "Balance",
      align: "end",
      render: (entry) => formatMoney(entry.balance_after, currency),
    },
  ];

  const paymentColumns: DataTableColumn<CustomerPayment>[] = [
    { key: "number", header: "Receipt", render: (payment) => payment.number },
    { key: "paid", header: "Paid on", render: (payment) => formatDate(payment.paid_on) },
    { key: "method", header: "Method", render: (payment) => humanize(payment.method) },
    { key: "reference", header: "Reference", render: (payment) => payment.reference ?? "—" },
    {
      key: "amount",
      header: "Amount",
      align: "end",
      render: (payment) => formatMoney(payment.amount, currency),
    },
  ];

  const storeCreditColumns: DataTableColumn<StoreCredit>[] = [
    { key: "number", header: "Credit", render: (credit) => credit.number },
    { key: "reason", header: "Reason", render: (credit) => credit.reason ?? "—" },
    { key: "expires", header: "Expires", render: (credit) => formatDate(credit.expires_on) },
    {
      key: "balance",
      header: "Balance",
      align: "end",
      render: (credit) => formatMoney(credit.balance, credit.currency ?? currency),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-end">
        <Button variant="outline" onClick={() => setShowingStatement(true)}>
          <FileText className="size-4" />
          Statement
        </Button>
      </div>
      <DocumentPreview
        open={showingStatement}
        onOpenChange={setShowingStatement}
        title="Account statement"
        description="Printable, as the customer would receive it."
        queryKey={["statement", customerId]}
        fetchHtml={(paper) => getStatementHtml(customerId, { paper })}
        papers={["A4", "Letter"]}
        defaultPaper="A4"
      />

      <Section title="Open invoices">
        <DataTable
          columns={invoiceColumns}
          rows={invoices.data ?? []}
          rowKey={(invoice) => invoice.sale_id}
          loading={invoices.isLoading}
          error={invoices.error ? { message: invoices.error.message } : null}
          onRetry={() => invoices.refetch()}
          empty={<p className="p-6 text-center text-sm text-muted-foreground">Nothing unpaid.</p>}
          mobileCardTitle={(invoice) => invoice.number}
          mobileCardFields={[
            {
              key: "outstanding",
              label: "Outstanding",
              render: (invoice) => formatMoney(invoice.outstanding, currency),
            },
          ]}
        />
      </Section>

      <Section title="Statement">
        <DataTable
          columns={ledgerColumns}
          rows={ledger.data?.entries ?? []}
          rowKey={(entry) => entry.id}
          loading={ledger.isLoading}
          error={ledger.error ? { message: ledger.error.message } : null}
          onRetry={() => ledger.refetch()}
          empty={
            <p className="p-6 text-center text-sm text-muted-foreground">
              Nothing has been put on this account yet.
            </p>
          }
          mobileCardTitle={(entry) => humanize(entry.kind)}
          mobileCardSubtitle={(entry) => formatDateTime(entry.occurred_at)}
          mobileCardFields={[
            {
              key: "amount",
              label: "Amount",
              render: (entry) => formatMoney(entry.amount, currency),
            },
            {
              key: "balance",
              label: "Balance",
              render: (entry) => formatMoney(entry.balance_after, currency),
            },
          ]}
        />
      </Section>

      <Section title="Payments">
        <DataTable
          columns={paymentColumns}
          rows={payments.data ?? []}
          rowKey={(payment) => payment.id}
          onRowClick={can("credit:allocate") ? setAllocating : undefined}
          loading={payments.isLoading}
          error={payments.error ? { message: payments.error.message } : null}
          onRetry={() => payments.refetch()}
          empty={<p className="p-6 text-center text-sm text-muted-foreground">No payments yet.</p>}
          mobileCardTitle={(payment) => payment.number}
          mobileCardFields={[
            {
              key: "amount",
              label: "Amount",
              render: (payment) => formatMoney(payment.amount, currency),
            },
          ]}
        />
      </Section>

      {(can("store_credit:issue") || (storeCredit.data?.credits.length ?? 0) > 0) && (
        <Section
          title="Store credit"
          aside={`${formatMoney(storeCredit.data?.balance, currency)} to spend`}
          action={
            can("store_credit:issue") && (
              <IssueStoreCreditDialog customerId={customerId} currency={currency} />
            )
          }
        >
          <DataTable
            columns={storeCreditColumns}
            rows={storeCredit.data?.credits ?? []}
            rowKey={(credit) => credit.id}
            onRowClick={(credit) => setViewingCredit(credit.id)}
            loading={storeCredit.isLoading}
            error={storeCredit.error ? { message: storeCredit.error.message } : null}
            onRetry={() => storeCredit.refetch()}
            empty={
              <p className="p-6 text-center text-sm text-muted-foreground">
                No store credit to spend.
              </p>
            }
            mobileCardTitle={(credit) => credit.number}
            mobileCardFields={[
              {
                key: "balance",
                label: "Balance",
                render: (credit) => formatMoney(credit.balance, currency),
              },
            ]}
          />
        </Section>
      )}

      <AllocatePaymentDialog
        payment={allocating}
        invoices={invoices.data ?? []}
        currency={currency}
        onOpenChange={(open) => !open && setAllocating(null)}
      />
      <StoreCreditSheet
        creditId={viewingCredit}
        onClose={() => setViewingCredit(null)}
        currency={currency}
      />
    </div>
  );
}

function Section({
  title,
  aside,
  action,
  children,
}: {
  title: string;
  aside?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        <div className="flex items-center gap-3">
          {aside && <span className="text-sm text-muted-foreground">{aside}</span>}
          {action}
        </div>
      </div>
      {children}
    </section>
  );
}
