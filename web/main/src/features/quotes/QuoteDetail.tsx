"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { DataTable, type DataTableColumn } from "@/components/shared/DataTable/DataTable";
import { ReasonDialog } from "@/components/shared/ReasonDialog";
import { StatusBadge } from "@/components/shared/StatusBadge";
import {
  WorkflowActions,
  type WorkflowAction,
} from "@/components/shared/WorkflowActions/WorkflowActions";
import { Skeleton } from "@/components/ui/skeleton";
import { useAcceptQuote, useDeclineQuote, useQuote, useSendQuote } from "@/hooks/queries/useQuotes";
import { usePermission } from "@/hooks/usePermission";
import { toast } from "@/hooks/useToast";
import { formatDate, formatMoney, formatQuantity } from "@/lib/format";
import { useSessionStore } from "@/stores/sessionStore";
import type { QuoteLineItem } from "@/types/api/quotes";

/**
 * A quote and its lifecycle: draft → sent → accepted or declined.
 * Accepting opens a service job from the lines — linked here once it
 * exists — so the work has somewhere to be recorded.
 */
export function QuoteDetail({ quoteId }: { quoteId: string }) {
  const router = useRouter();
  const { can } = usePermission();
  const fallbackCurrency = useSessionStore((state) => state.scope?.business?.currency) ?? "PKR";
  const modules = useSessionStore((state) => state.scope?.business?.modules) ?? [];
  const { data: quote, isLoading, isError } = useQuote(quoteId);
  const send = useSendQuote();
  const accept = useAcceptQuote();
  const decline = useDeclineQuote();
  const [declining, setDeclining] = useState(false);

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (isError || !quote) {
    return <p className="text-sm text-muted-foreground">We couldn&apos;t load this quote.</p>;
  }

  const currency = quote.currency ?? fallbackCurrency;
  const canManage = can("quote:manage");
  const run = async (fn: () => Promise<unknown>, message: string) => {
    try {
      await fn();
      toast.success(message);
    } catch {
      // Toasted by the hook.
    }
  };

  const actions: WorkflowAction[] = [
    {
      key: "edit",
      label: "Edit lines",
      available: quote.status === "draft",
      permitted: canManage,
      onAction: () => router.push(`/quotes/${quote.id}/edit`),
    },
    {
      key: "send",
      label: "Mark as sent",
      variant: "default",
      available: quote.status === "draft",
      permitted: canManage,
      pending: send.isPending,
      onAction: () => run(() => send.mutateAsync([quote.id]), "Marked as sent"),
    },
    {
      key: "accept",
      label: "Accepted",
      variant: "default",
      available: quote.status === "sent" && !quote.lapsed,
      permitted: canManage,
      pending: accept.isPending,
      confirm: {
        title: `Mark ${quote.number} accepted?`,
        description: "A job is opened from these lines so the work can be recorded.",
        confirmLabel: "Accept quote",
      },
      onAction: () => run(() => accept.mutateAsync([quote.id]), "Quote accepted"),
    },
    {
      key: "decline",
      label: "Declined",
      available: quote.status === "sent",
      permitted: canManage,
      onAction: () => setDeclining(true),
    },
  ];

  const columns: DataTableColumn<QuoteLineItem>[] = [
    { key: "description", header: "Description", render: (line) => line.description },
    { key: "qty", header: "Qty", align: "end", render: (line) => formatQuantity(line.quantity) },
    {
      key: "price",
      header: "Unit price",
      align: "end",
      render: (line) => formatMoney(line.unit_price, currency),
    },
    {
      key: "discount",
      header: "Discount",
      align: "end",
      render: (line) => formatMoney(line.discount, currency, { showZero: false }),
    },
    {
      key: "total",
      header: "Total",
      align: "end",
      render: (line) => formatMoney(line.line_total, currency),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold">{quote.number}</h2>
            <StatusBadge
              status={quote.lapsed && quote.status === "sent" ? "expired" : quote.status}
            />
          </div>
          <p className="text-sm text-muted-foreground">
            {quote.title ?? "Untitled"} · {quote.customer?.name ?? "No customer"} · valid until{" "}
            {formatDate(quote.valid_until)}
          </p>
          {quote.service_job_id && modules.includes("service_jobs") && (
            <Link
              href={`/service-jobs/${quote.service_job_id}`}
              className="text-sm text-brand-primary hover:underline"
            >
              Open the job →
            </Link>
          )}
        </div>
        <WorkflowActions actions={actions} />
      </div>

      <DataTable
        columns={columns}
        rows={quote.lines ?? []}
        rowKey={(line) => line.id}
        mobileCardTitle={(line) => line.description}
        mobileCardFields={[
          {
            key: "total",
            label: "Total",
            render: (line) => formatMoney(line.line_total, currency),
          },
        ]}
      />

      <div className="ml-auto flex w-full max-w-xs flex-col gap-1 text-sm">
        <Row label="Subtotal" value={formatMoney(quote.subtotal, currency)} />
        <Row label="Discounts" value={formatMoney(quote.discount_total, currency)} />
        <Row label="Tax" value={formatMoney(quote.tax_total, currency)} />
        <div className="flex justify-between border-t border-border pt-2 font-semibold">
          <span>Total</span>
          <span className="tabular-nums">{formatMoney(quote.total, currency)}</span>
        </div>
      </div>

      <ReasonDialog
        open={declining}
        onOpenChange={setDeclining}
        title={`Mark ${quote.number} declined?`}
        description="Why they said no is what the next quote learns from."
        placeholder="Went with a cheaper firm…"
        confirmLabel="Decline quote"
        destructive
        onSubmit={async (reason) => {
          await decline.mutateAsync([quote.id, reason]);
          toast.success("Quote declined");
        }}
      />

      {(quote.notes || quote.terms || quote.decline_reason) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {quote.notes && <Note title="Notes" body={quote.notes} />}
          {quote.terms && <Note title="Terms" body={quote.terms} />}
          {quote.decline_reason && <Note title="Why it was declined" body={quote.decline_reason} />}
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

function Note({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3 text-sm">
      <p className="text-xs font-semibold text-muted-foreground">{title}</p>
      <p className="mt-1 whitespace-pre-wrap">{body}</p>
    </div>
  );
}
