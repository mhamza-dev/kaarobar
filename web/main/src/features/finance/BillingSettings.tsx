"use client";

import { Check, CreditCard, ExternalLink } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable/DataTable";
import { DescriptionList } from "@/components/shared/DescriptionList";
import { DetailSheet } from "@/components/shared/DetailSheet";
import { EmptyState } from "@/components/shared/EmptyState";
import { LoadError } from "@/components/shared/LoadError";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useBillingInvoices,
  useCancelSubscription,
  useChangePlan,
  useOpenBillingPortal,
  usePlans,
  useResumeSubscription,
  useStartCheckout,
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

/** Leaves for a Stripe-hosted page. A full navigation, not a router push. */
function goTo(url: string) {
  window.location.assign(url);
}

/**
 * The organization's Kaarobar subscription — what it's on, how long is left,
 * how it's paid for, and what else is available. `serviceable`, `trialing`
 * and `days_remaining` are the server's verdicts; this screen never works out
 * from dates whether someone has been cut off.
 *
 * Two kinds of subscription live here. An invoiced one (`provider: manual`)
 * is changed in place. A card-billed one (`provider: stripe`) is changed in
 * Stripe's customer portal and synced back by webhook — the backend refuses
 * to change it directly, so this screen sends people to the portal instead.
 *
 * Arrives with `?plan=<code>` from the marketing site's pricing page (a
 * signed-in visitor clicking a plan), and with `?checkout=success|cancelled`
 * on the way back from Stripe.
 */
export function BillingSettings() {
  const { can } = usePermission();
  const canManage = can("organization:billing");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const returning = searchParams.get("checkout");
  const requestedPlan = searchParams.get("plan");

  // Back from Stripe, the webhook may land a moment after the customer does:
  // keep asking until the subscription shows as card-billed.
  const status = useSubscription(
    (current) => returning === "success" && current?.subscription?.provider !== "stripe",
  );
  const { isLoading, isError, refetch } = status;
  const subscription = status.data?.subscription ?? null;
  const trialEligible = status.data?.trialEligible ?? false;

  const plansQuery = usePlans();
  const plans = plansQuery.data?.plans;
  const checkoutEnabled = plansQuery.data?.checkoutEnabled ?? false;
  const invoices = useBillingInvoices();
  const subscribe = useSubscribe();
  const changePlan = useChangePlan();
  const cancel = useCancelSubscription();
  const resume = useResumeSubscription();
  const checkout = useStartCheckout();
  const portal = useOpenBillingPortal();
  const [choosing, setChoosing] = useState<Plan | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [viewingInvoice, setViewingInvoice] = useState<BillingInvoice | null>(null);

  // Said once per return from Stripe, not on every re-render.
  const announced = useRef<string | null>(null);
  useEffect(() => {
    if (!returning || announced.current === returning) return;
    announced.current = returning;
    if (returning === "success") toast.success("Payment set up — thank you!");
    else toast.info("Checkout cancelled — nothing was charged.");
  }, [returning]);

  // Done waiting: drop `?checkout=` so a reload doesn't announce it again.
  useEffect(() => {
    if (returning === "success" && subscription?.provider === "stripe") {
      router.replace(pathname, { scroll: false });
    }
  }, [returning, subscription?.provider, router, pathname]);

  // A plan picked on the pricing page opens its confirmation, derived from
  // the URL rather than copied into state, until it's answered either way.
  const [offerAnswered, setOfferAnswered] = useState(false);
  const requested = plans?.find((candidate) => candidate.code === requestedPlan);
  const offer =
    !offerAnswered && canManage && requested && subscription?.plan?.code !== requested.code
      ? requested
      : null;
  const dialogPlan = choosing ?? offer;
  const closeChoice = () => {
    setChoosing(null);
    if (offer) {
      setOfferAnswered(true);
      // Dropped so Back or a reload doesn't offer it again.
      router.replace(pathname, { scroll: false });
    }
  };

  if (isLoading) return <Skeleton className="h-40 w-full" />;
  // Falling through would say "No active subscription — pick a plan" to an
  // organization that may well be paying.
  if (isError) return <LoadError what="your subscription" onRetry={() => refetch()} />;

  const current = subscription?.plan;
  const ended = !!subscription && ["canceled", "expired"].includes(subscription.status);
  const live = !!subscription && !ended;
  const cardBilled = live && subscription.provider === "stripe";
  const awaitingWebhook = returning === "success" && !cardBilled;

  const startCheckout = async (plan: Plan) => {
    try {
      const session = await checkout.mutateAsync([plan.code]);
      goTo(session.url);
    } catch {
      // Toasted by the hook.
    }
  };

  const openPortal = async () => {
    try {
      const session = await portal.mutateAsync([]);
      goTo(session.url);
    } catch {
      // Toasted by the hook.
    }
  };

  // Choosing a plan with no live subscription: a first-timer gets the free
  // trial with no card; anyone else pays now, by card where that's set up.
  const choosingTrial = !live && !!dialogPlan?.trial_days && trialEligible;
  const choosingCheckout = !live && !choosingTrial && checkoutEnabled;

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
      {awaitingWebhook && (
        <p
          role="status"
          className="rounded-xl border border-border bg-muted/50 px-4 py-3 text-sm text-muted-foreground"
        >
          Confirming your payment with Stripe — this usually takes a few seconds.
        </p>
      )}

      <section className="rounded-xl border border-border bg-card p-5">
        {live ? (
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold">{current?.name ?? "Subscription"}</h2>
                <StatusBadge status={subscription.status} />
                {cardBilled && (
                  <Badge variant="secondary">
                    <CreditCard className="size-3" aria-hidden /> Paid by card
                  </Badge>
                )}
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
              {!cardBilled && checkoutEnabled && canManage && (
                <p className="mt-2 max-w-prose text-sm text-muted-foreground">
                  {subscription.trialing
                    ? `Add a card now and you won't be charged until your trial ends on ${formatDate(subscription.trial_ends_at)}.`
                    : "Pay by card and renewals are collected automatically — no invoices to settle by hand."}
                </p>
              )}
            </div>
            {canManage && (
              <div className="flex flex-wrap gap-2">
                {cardBilled ? (
                  <Button disabled={portal.isPending} onClick={openPortal}>
                    <ExternalLink aria-hidden /> Manage billing
                  </Button>
                ) : (
                  <>
                    {checkoutEnabled && current && (
                      <Button disabled={checkout.isPending} onClick={() => startCheckout(current)}>
                        <CreditCard aria-hidden />
                        {subscription.trialing ? "Add a card" : "Pay by card"}
                      </Button>
                    )}
                    {subscription.cancel_at_period_end ? (
                      <Button
                        variant="outline"
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
                  </>
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
        {plansQuery.isError && <LoadError what="the plans" onRetry={() => plansQuery.refetch()} />}
        <div className="grid gap-3 md:grid-cols-3">
          {(plans ?? []).map((plan) => {
            const isCurrent = live && current?.code === plan.code;
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
                  {plan.trial_days && trialEligible ? (
                    <li className="text-xs text-muted-foreground">
                      {plan.trial_days}-day free trial
                    </li>
                  ) : null}
                </ul>
                {canManage && (
                  <Button
                    className="mt-auto"
                    variant={isCurrent ? "outline" : "default"}
                    disabled={isCurrent || (cardBilled && portal.isPending)}
                    onClick={() => (cardBilled ? openPortal() : setChoosing(plan))}
                  >
                    {isCurrent ? "Current plan" : live ? "Switch" : "Choose"}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
        {cardBilled && canManage && (
          <p className="text-xs text-muted-foreground">
            Your plan is paid by card, so switching opens Stripe&apos;s billing portal.
          </p>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold">Invoices</h2>
        <DataTable
          columns={invoiceColumns}
          rows={invoices.data ?? []}
          rowKey={(invoice) => invoice.id}
          onRowClick={setViewingInvoice}
          loading={invoices.isLoading}
          error={invoices.error}
          onRetry={() => invoices.refetch()}
          empty={<EmptyState size="sm" title={<>No invoices yet.</>} />}
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

      <DetailSheet
        open={!!viewingInvoice}
        onOpenChange={(open) => !open && setViewingInvoice(null)}
        eyebrow="Kaarobar invoice"
        title={viewingInvoice?.number ?? "Invoice"}
        description={
          viewingInvoice
            ? `${formatDate(viewingInvoice.period_start)} – ${formatDate(viewingInvoice.period_end)}`
            : undefined
        }
        status={
          viewingInvoice && (
            <StatusBadge status={viewingInvoice.overdue ? "overdue" : viewingInvoice.status} />
          )
        }
      >
        {viewingInvoice && (
          <InvoiceBody invoice={viewingInvoice} currency={viewingInvoice.currency ?? "PKR"} />
        )}
      </DetailSheet>

      <ConfirmDialog
        open={!!dialogPlan}
        onOpenChange={(open) => !open && closeChoice()}
        title={live ? `Switch to ${dialogPlan?.name}?` : `Subscribe to ${dialogPlan?.name}?`}
        description={
          dialogPlan
            ? `${formatMoney(dialogPlan.amount, dialogPlan.currency)} per ${dialogPlan.interval}` +
              (live
                ? ". The change is prorated on your next invoice."
                : choosingTrial
                  ? `, after a ${dialogPlan.trial_days}-day free trial. No card needed to start.`
                  : choosingCheckout
                    ? ". You'll enter your card on Stripe's secure checkout page."
                    : ". We'll send an invoice for the first period.")
            : undefined
        }
        confirmLabel={
          live
            ? "Switch plan"
            : choosingTrial
              ? "Start free trial"
              : choosingCheckout
                ? "Continue to payment"
                : "Subscribe"
        }
        loading={subscribe.isPending || changePlan.isPending || checkout.isPending}
        onConfirm={async () => {
          if (!dialogPlan) return;
          if (choosingCheckout) return startCheckout(dialogPlan);
          try {
            if (live) await changePlan.mutateAsync([dialogPlan.code]);
            else await subscribe.mutateAsync([dialogPlan.code]);
            toast.success(
              choosingTrial
                ? `Your ${dialogPlan.name} trial has started`
                : `You're on ${dialogPlan.name}`,
            );
            closeChoice();
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

function InvoiceBody({ invoice, currency }: { invoice: BillingInvoice; currency: string }) {
  const money = (value: string | null | undefined) => formatMoney(value, currency);
  return (
    <div className="flex flex-col gap-4">
      {invoice.last_error && (
        <p className="rounded-lg bg-danger-soft p-3 text-sm text-danger">
          Payment failed: {invoice.last_error}
        </p>
      )}
      <ul className="divide-y divide-border rounded-lg border border-border text-sm">
        {invoice.lines.map((line, index) => (
          <li key={index} className="flex items-start justify-between gap-3 p-2">
            <div>
              <p>{line.description}</p>
              {line.quantity !== 1 && (
                <p className="text-xs text-muted-foreground">
                  {line.quantity} × {money(line.unit_amount)}
                </p>
              )}
            </div>
            <span className="tabular-nums">{money(line.amount)}</span>
          </li>
        ))}
      </ul>
      <DescriptionList
        items={[
          { label: "Subtotal", value: money(invoice.subtotal) },
          { label: "Tax", value: money(invoice.tax_total) },
          { label: "Total", value: <span className="font-semibold">{money(invoice.total)}</span> },
          { label: "Paid", value: money(invoice.amount_paid) },
          { label: "Outstanding", value: money(invoice.outstanding) },
          { label: "Due", value: formatDate(invoice.due_at) },
          { label: "Paid on", value: formatDate(invoice.paid_at), hidden: !invoice.paid_at },
          {
            label: "Payment attempts",
            value: String(invoice.attempts ?? 0),
            hidden: !invoice.attempts,
          },
        ]}
      />
    </div>
  );
}
