"use client";

import { Check } from "lucide-react";
import { useState } from "react";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useBillingInvoices,
  useCancelSubscription,
  useChangePlan,
  usePlans,
  useResumeSubscription,
  useSubscribe,
  useSubscription,
} from "@/hooks/queries/useFinance";
import { usePermission } from "@/hooks/usePermission";
import { toast } from "@/hooks/useToast";
import { formatDate, formatMoney, humanize } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { BillingInvoice, Plan } from "@/types/api/billing";

/** "max_branches" → "Branches"; "null" limit → "Unlimited". */
function limitLine(key: string, value: number | null): string {
  const label = humanize(key.replace(/^max_/, ""));
  return value === null ? `Unlimited ${label.toLowerCase()}` : `${value} ${label.toLowerCase()}`;
}

/**
 * The organization's Kaarobar subscription — what it's on, how long is left,
 * and what else is available. `serviceable`, `trialing` and
 * `days_remaining` are the server's verdicts; this screen never works out
 * from dates whether someone has been cut off.
 */
export function BillingSettings() {
  const { can } = usePermission();
  const canManage = can("organization:billing");
  const { data: subscription, isLoading } = useSubscription();
  const { data: plans } = usePlans();
  const invoices = useBillingInvoices();
  const subscribe = useSubscribe();
  const changePlan = useChangePlan();
  const cancel = useCancelSubscription();
  const resume = useResumeSubscription();
  const [choosing, setChoosing] = useState<Plan | null>(null);
  const [cancelling, setCancelling] = useState(false);

  if (isLoading) return <Skeleton className="h-40 w-full" />;

  const current = subscription?.plan;
  const ended = subscription && ["canceled", "expired"].includes(subscription.status);

  const invoiceColumns: DataTableColumn<BillingInvoice>[] = [
    { key: "number", header: "Invoice", render: (invoice) => invoice.number ?? "—" },
    {
      key: "period",
      header: "Period",
      render: (invoice) =>
        `${formatDate(invoice.period_start)} – ${formatDate(invoice.period_end)}`,
    },
    {
      key: "status",
      header: "Status",
      render: (invoice) => (
        <div>
          <StatusBadge status={invoice.overdue ? "overdue" : invoice.status} />
          {invoice.last_error && (
            <p className="mt-1 text-xs text-destructive">{invoice.last_error}</p>
          )}
        </div>
      ),
    },
    {
      key: "total",
      header: "Total",
      align: "end",
      render: (invoice) => formatMoney(invoice.total, invoice.currency ?? "PKR"),
    },
    {
      key: "outstanding",
      header: "Outstanding",
      align: "end",
      render: (invoice) =>
        formatMoney(invoice.outstanding, invoice.currency ?? "PKR", { showZero: false }),
    },
  ];

  return (
    <div className="flex flex-col gap-8">
      <section className="rounded-xl border border-border bg-card p-5">
        {subscription && !ended ? (
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold">{current?.name ?? "Subscription"}</h2>
                <StatusBadge status={subscription.status} />
                {!subscription.serviceable && (
                  <Badge variant="destructive">Service suspended</Badge>
                )}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {subscription.trialing
                  ? `Free trial — ${subscription.days_remaining ?? 0} days left`
                  : subscription.cancel_at_period_end
                    ? `Ends ${formatDate(subscription.current_period_end)}`
                    : `Renews ${formatDate(subscription.current_period_end)}`}
                {current?.amount &&
                  ` · ${formatMoney(current.amount, current.currency)} per ${current.interval}`}
              </p>
              {subscription.status === "past_due" && subscription.grace_until && (
                <p className="mt-1 text-sm text-destructive">
                  Payment failed — service continues until {formatDate(subscription.grace_until)}.
                </p>
              )}
            </div>
            {canManage && (
              <div className="flex gap-2">
                {subscription.cancel_at_period_end ? (
                  <Button
                    disabled={resume.isPending}
                    onClick={async () => {
                      try {
                        await resume.mutateAsync([]);
                        toast.success("Subscription resumed");
                      } catch {
                        // Toasted by the hook.
                      }
                    }}
                  >
                    Keep subscription
                  </Button>
                ) : (
                  <Button variant="outline" onClick={() => setCancelling(true)}>
                    Cancel subscription
                  </Button>
                )}
              </div>
            )}
          </div>
        ) : (
          <div>
            <h2 className="text-lg font-semibold">No active subscription</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Pick a plan below{canManage ? "" : " — ask an owner to subscribe"}.
            </p>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold">Plans</h2>
        <div className="grid gap-3 md:grid-cols-3">
          {(plans ?? []).map((plan) => {
            const isCurrent = !ended && current?.code === plan.code;
            return (
              <div
                key={plan.id}
                className={cn(
                  "flex flex-col gap-3 rounded-xl border bg-card p-4",
                  isCurrent ? "border-brand-primary" : "border-border",
                )}
              >
                <div>
                  <p className="font-semibold">{plan.name}</p>
                  <p className="text-2xl font-semibold tabular-nums">
                    {formatMoney(plan.amount, plan.currency)}
                    <span className="text-sm font-normal text-muted-foreground">
                      /{plan.interval}
                    </span>
                  </p>
                  {plan.description && (
                    <p className="mt-1 text-sm text-muted-foreground">{plan.description}</p>
                  )}
                </div>
                <ul className="flex flex-col gap-1 text-sm">
                  {Object.entries(plan.limits).map(([key, value]) => (
                    <li key={key} className="flex items-center gap-2">
                      <Check className="size-3.5 text-success" />
                      {limitLine(key, value)}
                    </li>
                  ))}
                  {plan.trial_days ? (
                    <li className="text-xs text-muted-foreground">
                      {plan.trial_days}-day free trial
                    </li>
                  ) : null}
                </ul>
                {canManage && (
                  <Button
                    className="mt-auto"
                    variant={isCurrent ? "outline" : "default"}
                    disabled={isCurrent}
                    onClick={() => setChoosing(plan)}
                  >
                    {isCurrent ? "Current plan" : subscription && !ended ? "Switch" : "Choose"}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold">Invoices</h2>
        <DataTable
          columns={invoiceColumns}
          rows={invoices.data ?? []}
          rowKey={(invoice) => invoice.id}
          loading={invoices.isLoading}
          empty={<p className="p-6 text-center text-sm text-muted-foreground">No invoices yet.</p>}
          mobileCardTitle={(invoice) => invoice.number ?? "Invoice"}
          mobileCardFields={[
            {
              key: "total",
              label: "Total",
              render: (invoice) => formatMoney(invoice.total, invoice.currency ?? "PKR"),
            },
          ]}
        />
      </section>

      <ConfirmDialog
        open={!!choosing}
        onOpenChange={(open) => !open && setChoosing(null)}
        title={
          subscription && !ended
            ? `Switch to ${choosing?.name}?`
            : `Subscribe to ${choosing?.name}?`
        }
        description={
          choosing
            ? `${formatMoney(choosing.amount, choosing.currency)} per ${choosing.interval}` +
              (!subscription || ended
                ? choosing.trial_days
                  ? `, after a ${choosing.trial_days}-day free trial.`
                  : "."
                : ". The change is prorated on your next invoice.")
            : undefined
        }
        confirmLabel={subscription && !ended ? "Switch plan" : "Subscribe"}
        loading={subscribe.isPending || changePlan.isPending}
        onConfirm={async () => {
          if (!choosing) return;
          try {
            if (subscription && !ended) await changePlan.mutateAsync([choosing.code]);
            else await subscribe.mutateAsync([choosing.code]);
            toast.success(`You're on ${choosing.name}`);
            setChoosing(null);
          } catch {
            // Toasted by the hook.
          }
        }}
      />
      <ConfirmDialog
        open={cancelling}
        onOpenChange={setCancelling}
        title="Cancel the subscription?"
        description={`Everything keeps working until ${formatDate(subscription?.current_period_end)}. You can change your mind until then.`}
        confirmLabel="Cancel at period end"
        destructive
        loading={cancel.isPending}
        onConfirm={async () => {
          try {
            await cancel.mutateAsync([]);
            toast.success("Subscription will end at the period end");
            setCancelling(false);
          } catch {
            // Toasted by the hook.
          }
        }}
      />
    </div>
  );
}
