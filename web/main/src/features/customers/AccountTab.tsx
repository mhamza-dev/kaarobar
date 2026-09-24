"use client";

import Link from "next/link";

import { DataTable, type DataTableColumn } from "@/components/shared/DataTable/DataTable";
import {
  useCustomerLedger,
  useCustomerPayments,
  useOpenInvoices,
  useStoreCredit,
} from "@/hooks/queries/useCustomers";
import { formatDate, formatDateTime, formatMoney, humanize } from "@/lib/format";
import type {
  CreditInvoice,
  CustomerLedgerEntry,
  CustomerPayment,
  StoreCredit,
} from "@/types/api/crm";

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

      {(storeCredit.data?.credits.length ?? 0) > 0 && (
        <Section
          title="Store credit"
          aside={`${formatMoney(storeCredit.data?.balance, currency)} to spend`}
        >
          <DataTable
            columns={storeCreditColumns}
            rows={storeCredit.data?.credits ?? []}
            rowKey={(credit) => credit.id}
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
    </div>
  );
}

function Section({
  title,
  aside,
  children,
}: {
  title: string;
  aside?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {aside && <span className="text-sm text-muted-foreground">{aside}</span>}
      </div>
      {children}
    </section>
  );
}
