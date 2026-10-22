"use client";

import {
  ArrowRight,
  CheckCircle2,
  CreditCard,
  Globe,
  Laptop,
  type LucideIcon,
  Package,
  Percent,
  ScanLine,
  Smartphone,
  Store,
  Users,
} from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { usePlans, useStartCheckout, useSubscription } from "@/hooks/queries/useFinance";
import { usePermission } from "@/hooks/usePermission";
import { env } from "@/lib/env";
import { formatDate } from "@/lib/format";
import { useSessionStore } from "@/stores/sessionStore";

type Step = { label: string; detail: string; href: string; icon: LucideIcon; permission: string };

/** The first things a new shop does, in the order that makes the next one possible. */
const STEPS: Step[] = [
  {
    label: "Add your products",
    detail: "What you sell, its price, and whether you count its stock.",
    href: "/products/new",
    icon: Package,
    permission: "product:create",
  },
  {
    label: "Set up your taxes",
    detail: "Sales tax rates, and whether your prices include them.",
    href: "/settings/taxes",
    icon: Percent,
    permission: "tax:manage",
  },
  {
    label: "Add a till",
    detail: "Each counter that takes money is a register with its own cash drawer.",
    href: "/registers",
    icon: Store,
    permission: "register:manage",
  },
  {
    label: "Invite your staff",
    detail: "Give each person their own sign-in and only the access they need.",
    href: "/settings/staff/invitations",
    icon: Users,
    permission: "staff:invite",
  },
  {
    label: "Make your first sale",
    detail: "Open the till, scan or search, and take payment.",
    href: "/pos",
    icon: ScanLine,
    permission: "sales:checkout",
  },
];

/**
 * Where a new owner lands straight after signing up: what they've bought
 * (or are trialling), the other places Kaarobar runs, and the first few
 * things to set up. Reachable later from the URL, but not in the nav — it
 * stops being useful once the shop is running.
 */
export function Welcome() {
  const scope = useSessionStore((state) => state.scope);
  const { can } = usePermission();
  const firstName = scope?.user?.name.split(" ")[0] ?? "";
  const steps = STEPS.filter((step) => can(step.permission));

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow={scope?.business?.name}
        title={`Welcome to Kaarobar, ${firstName}`}
        description="Your account is ready. Here's what you have, and where to start."
        actions={
          // A link, not a button: it navigates, and is announced as one.
          <Link href="/dashboard" className={buttonVariants()}>
            Go to dashboard <ArrowRight aria-hidden />
          </Link>
        }
      />

      <PlanSummary />

      <section aria-labelledby="everywhere" className="flex flex-col gap-3">
        <div>
          <h2 id="everywhere" className="text-sm font-semibold">
            Use Kaarobar everywhere
          </h2>
          <p className="text-sm text-muted-foreground">
            One subscription covers every app. Sign in with the same email and password.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <AppCard
            icon={Globe}
            title="Web"
            detail="You're using it now — any modern browser, on any computer."
            links={[]}
            note="Bookmark this page to come back."
          />
          <AppCard
            icon={Laptop}
            title="Desktop"
            detail="A dedicated till app for Windows and macOS, with receipt printers and cash drawers."
            links={
              env.desktopDownloadUrl
                ? [{ label: "Download for desktop", href: env.desktopDownloadUrl }]
                : []
            }
            note={env.desktopDownloadUrl ? undefined : "Coming soon"}
          />
          <AppCard
            icon={Smartphone}
            title="Mobile"
            detail="Sell, check stock and see today's takings from your phone."
            links={[
              ...(env.iosAppUrl ? [{ label: "App Store", href: env.iosAppUrl }] : []),
              ...(env.androidAppUrl ? [{ label: "Google Play", href: env.androidAppUrl }] : []),
            ]}
            note={env.iosAppUrl || env.androidAppUrl ? undefined : "Coming soon"}
          />
        </div>
      </section>

      {steps.length > 0 && (
        <section aria-labelledby="first-steps" className="flex flex-col gap-3">
          <h2 id="first-steps" className="text-sm font-semibold">
            Get your shop ready
          </h2>
          <ol className="divide-y divide-border rounded-xl border border-border bg-card">
            {steps.map((step, index) => (
              <li key={step.href}>
                <Link
                  href={step.href}
                  className="flex items-center gap-4 p-4 transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <step.icon className="size-4" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">
                      <span className="sr-only">Step {index + 1}: </span>
                      {step.label}
                    </span>
                    <span className="block text-sm text-muted-foreground">{step.detail}</span>
                  </span>
                  <ArrowRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                </Link>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}

/** What the organization is on — or isn't yet — and the one thing to do about it. */
function PlanSummary() {
  const { can } = usePermission();
  const canManage = can("organization:billing");
  const status = useSubscription();
  const catalogue = usePlans();
  const checkout = useStartCheckout();

  if (status.isLoading || catalogue.isLoading) return <Skeleton className="h-24 w-full" />;
  // Billing is optional: a deployment with no plans has nothing to say here.
  if (status.isError || !catalogue.data?.plans.length) return null;

  const subscription = status.data?.subscription;
  const plan = subscription?.plan;
  const checkoutEnabled = catalogue.data.checkoutEnabled;

  return (
    <section className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-card p-5">
      <div className="flex items-start gap-3">
        <CheckCircle2
          className={subscription ? "mt-0.5 size-5 text-success" : "mt-0.5 size-5 text-muted-foreground"}
          aria-hidden
        />
        <div>
          {subscription && plan ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold">Kaarobar {plan.name}</p>
                <StatusBadge status={subscription.status} />
              </div>
              <p className="text-sm text-muted-foreground">
                {subscription.trialing
                  ? `Your free trial runs until ${formatDate(subscription.trial_ends_at)} — ${subscription.days_remaining ?? 0} days. No charge until then.`
                  : `Renews ${formatDate(subscription.current_period_end)}.`}
              </p>
            </>
          ) : (
            <>
              <p className="font-semibold">No plan yet</p>
              <p className="text-sm text-muted-foreground">
                Pick a plan to keep using Kaarobar beyond setup.
              </p>
            </>
          )}
        </div>
      </div>
      {canManage && (
        <div className="flex flex-wrap gap-2">
          {subscription && plan && subscription.provider !== "stripe" && checkoutEnabled && (
            <Button
              disabled={checkout.isPending}
              onClick={async () => {
                try {
                  const session = await checkout.mutateAsync([plan.code]);
                  window.location.assign(session.url);
                } catch {
                  // Toasted by the hook.
                }
              }}
            >
              <CreditCard aria-hidden /> {subscription.trialing ? "Add a card" : "Pay by card"}
            </Button>
          )}
          <Link href="/settings/billing" className={buttonVariants({ variant: "outline" })}>
            {subscription ? "Manage subscription" : "Choose a plan"}
          </Link>
        </div>
      )}
    </section>
  );
}

function AppCard({
  icon: Icon,
  title,
  detail,
  links,
  note,
}: {
  icon: LucideIcon;
  title: string;
  detail: string;
  links: Array<{ label: string; href: string }>;
  note?: string;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
      <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="size-4" aria-hidden />
      </span>
      <div>
        <p className="font-semibold">{title}</p>
        <p className="text-sm text-muted-foreground">{detail}</p>
      </div>
      <div className="mt-auto flex flex-wrap items-center gap-2">
        {links.map((link) => (
          <a
            key={link.href}
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({ size: "sm", variant: "outline" })}
          >
            {link.label}
          </a>
        ))}
        {note && <span className="text-xs text-muted-foreground">{note}</span>}
      </div>
    </div>
  );
}
