"use client";

import Link from "next/link";
import { useState } from "react";

import { DescriptionList } from "@/components/shared/DescriptionList";
import { DetailSheet } from "@/components/shared/DetailSheet";
import { StatusBadge } from "@/components/shared/StatusBadge";
import {
  WorkflowActions,
  type WorkflowAction,
} from "@/components/shared/WorkflowActions/WorkflowActions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  useCapturePaymentIntent,
  usePaymentIntent,
  useRefundPaymentIntent,
  useSyncPaymentIntent,
} from "@/hooks/queries/useFinance";
import { usePermission } from "@/hooks/usePermission";
import { toast } from "@/hooks/useToast";
import { formatDateTime, formatMoney, humanize } from "@/lib/format";
import { useSessionStore } from "@/stores/sessionStore";
import type { PaymentIntent } from "@/types/api/payments";

/** The states still waiting on the gateway — the ones a Sync can move. */
const OPEN_STATUSES = ["pending", "processing", "requires_action", "authorized"];

/**
 * One gateway payment and everything the gateway has said about it — each
 * authorisation, capture, refund and failure — with what can be done next:
 * capture a hold, refund what was taken, or ask the gateway where a stuck
 * one stands.
 */
export function PaymentSheet({
  intentId,
  onClose,
}: {
  intentId: string | null;
  onClose: () => void;
}) {
  const { can } = usePermission();
  const fallbackCurrency = useSessionStore((state) => state.scope?.business?.currency) ?? "PKR";
  const { data: intent, isLoading, error, refetch } = usePaymentIntent(intentId);
  const capture = useCapturePaymentIntent();
  const sync = useSyncPaymentIntent();
  const [refunding, setRefunding] = useState(false);

  const currency = intent?.currency ?? fallbackCurrency;
  const money = (value: string | null | undefined) => formatMoney(value, currency);

  const actions: WorkflowAction[] = intent
    ? [
        {
          key: "capture",
          label: "Capture",
          variant: "default",
          available: intent.status === "authorized",
          permitted: can("payment:charge"),
          pending: capture.isPending,
          confirm: {
            title: "Capture this payment?",
            description: `${money(intent.amount)} is taken from the customer's card or wallet.`,
            confirmLabel: "Capture",
          },
          onAction: async () => {
            await capture.mutateAsync([intent.id]);
            toast.success("Payment captured");
          },
        },
        {
          key: "sync",
          label: "Check with gateway",
          available: OPEN_STATUSES.includes(intent.status),
          permitted: can("payment:charge"),
          pending: sync.isPending,
          onAction: async () => {
            await sync.mutateAsync([intent.id]);
            toast.success("Checked with the gateway");
          },
        },
        {
          key: "refund",
          label: "Refund",
          variant: "destructive",
          available: ["captured", "partially_refunded"].includes(intent.status),
          permitted: can("payment:refund"),
          onAction: () => setRefunding(true),
        },
      ]
    : [];

  return (
    <>
      <DetailSheet
        open={!!intentId}
        onOpenChange={(open) => !open && onClose()}
        eyebrow="Card payment"
        title={intent ? (intent.reference ?? intent.external_id ?? "Payment") : undefined}
        status={intent && <StatusBadge status={intent.status} />}
        loading={isLoading}
        error={error}
        onRetry={() => refetch()}
        what="this payment"
        actions={<WorkflowActions actions={actions} />}
      >
        {intent && (
          <div className="flex flex-col gap-4">
            {intent.failure_message && (
              <p className="rounded-lg bg-danger-soft p-3 text-sm text-danger">
                {intent.failure_message}
              </p>
            )}
            <DescriptionList
              items={[
                {
                  label: "Amount",
                  value: <span className="font-semibold">{money(intent.amount)}</span>,
                },
                { label: "Captured", value: money(intent.captured_amount) },
                {
                  label: "Refunded",
                  value: money(intent.refunded_amount),
                  hidden: !(Number(intent.refunded_amount ?? 0) > 0),
                },
                {
                  label: "Sale",
                  hidden: !intent.sale_id,
                  value: (
                    <Link
                      href={`/sales/${intent.sale_id}`}
                      className="text-brand-primary underline-offset-2 hover:underline"
                    >
                      View sale
                    </Link>
                  ),
                },
                { label: "Gateway reference", value: intent.external_id },
                { label: "Authorised", value: formatDateTime(intent.authorized_at) },
                { label: "Captured at", value: formatDateTime(intent.captured_at) },
              ]}
            />

            <section>
              <h3 className="mb-2 text-sm font-semibold">What the gateway said</h3>
              {(intent.transactions ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">Nothing yet.</p>
              ) : (
                <ol className="flex flex-col gap-2 border-l border-border pl-4">
                  {(intent.transactions ?? []).map((transaction) => (
                    <li key={transaction.id} className="text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{humanize(transaction.kind)}</span>
                        <StatusBadge status={transaction.status} />
                        <span className="ml-auto tabular-nums">{money(transaction.amount)}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {formatDateTime(transaction.occurred_at)}
                        {transaction.card_last_four &&
                          ` · ${transaction.card_scheme ?? "Card"} ···${transaction.card_last_four}`}
                        {transaction.fee_amount && ` · fee ${money(transaction.fee_amount)}`}
                      </p>
                      {transaction.failure_message && (
                        <p className="text-xs text-destructive">{transaction.failure_message}</p>
                      )}
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </div>
        )}
      </DetailSheet>

      {intent && refunding && (
        <RefundDialog
          intent={intent}
          currency={currency}
          onOpenChange={() => setRefunding(false)}
        />
      )}
    </>
  );
}

function RefundDialog({
  intent,
  currency,
  onOpenChange,
}: {
  intent: PaymentIntent;
  currency: string;
  onOpenChange: (open: boolean) => void;
}) {
  const refund = useRefundPaymentIntent();
  // Display-only: what's left to refund, from the backend's own figures.
  const remaining = Number(intent.captured_amount ?? 0) - Number(intent.refunded_amount ?? 0);
  const [amount, setAmount] = useState(remaining > 0 ? remaining.toFixed(2) : "");

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Refund through the gateway</DialogTitle>
          <DialogDescription>
            Up to {formatMoney(remaining.toFixed(2), currency)} can still be refunded. The money
            goes back to the customer&apos;s card or wallet.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="refund-amount">Amount</Label>
          <Input
            id="refund-amount"
            type="number"
            min={0}
            step="0.01"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={refund.isPending || !(Number(amount) > 0)}
            onClick={async () => {
              try {
                await refund.mutateAsync([intent.id, amount]);
                toast.success("Refund sent");
                onOpenChange(false);
              } catch {
                // Toasted by the hook.
              }
            }}
          >
            Refund {amount && formatMoney(amount, currency)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
