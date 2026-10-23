"use client";

import { AlertTriangle, Clock, MailWarning } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { useResendConfirmation } from "@/hooks/queries/useAuth";
import { useSubscription } from "@/hooks/queries/useFinance";
import { usePermission } from "@/hooks/usePermission";
import { toast } from "@/hooks/useToast";
import { cn } from "@/lib/utils";
import { useSessionStore } from "@/stores/sessionStore";

/** The trial is mentioned on every screen only once it's nearly over. */
const TRIAL_REMINDER_DAYS = 7;

type Tone = "danger" | "warning" | "info";

function Banner({
  tone,
  icon: Icon,
  children,
}: {
  tone: Tone;
  icon: typeof AlertTriangle;
  children: React.ReactNode;
}) {
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-1 border-b px-4 py-2.5 text-sm md:px-6",
        tone === "danger" && "border-danger/20 bg-danger-soft text-danger",
        tone === "warning" && "border-warning/20 bg-warning-soft text-warning",
        tone === "info" && "border-border bg-accent/50 text-foreground",
      )}
    >
      <Icon className="size-4 shrink-0" aria-hidden />
      {children}
    </div>
  );
}

const linkClass = "font-medium underline underline-offset-2 hover:no-underline";

/**
 * Account-level notices above every screen, most urgent first, at most one
 * about the subscription:
 *
 * - **Lapsed** — from `/me`, so it shows on every screen without asking. The
 *   API refuses everything but billing at this point; `client.ts` sends
 *   anyone who trips over that to the billing screen.
 * - **Payment failed / trial ending** — only to people who can do something
 *   about it (`organization:billing`).
 * - **Email unconfirmed** — to the user it's about, with a resend.
 */
export function AccountBanners() {
  const scope = useSessionStore((state) => state.scope);
  const { can } = usePermission();
  const canManage = can("organization:billing");
  const status = useSubscription();
  const resend = useResendConfirmation();
  const [resent, setResent] = useState(false);

  const lapsed = scope?.subscription?.serviceable === false;
  const subscription = status.data?.subscription;
  const user = scope?.user;

  let billing: React.ReactNode = null;

  if (lapsed) {
    billing = (
      <Banner tone="danger" icon={AlertTriangle}>
        <span>Your Kaarobar subscription has ended, so selling and stock are paused.</span>
        {canManage ? (
          <Link href="/settings/billing" className={linkClass}>
            Renew to carry on
          </Link>
        ) : (
          <span>Ask the account owner to renew it.</span>
        )}
      </Banner>
    );
  } else if (canManage && subscription?.status === "past_due") {
    billing = (
      <Banner tone="warning" icon={AlertTriangle}>
        <span>
          Your last payment failed. Everything keeps working for {subscription.days_remaining ?? 0}{" "}
          more days.
        </span>
        <Link href="/settings/billing" className={linkClass}>
          Update payment
        </Link>
      </Banner>
    );
  } else if (
    canManage &&
    subscription?.trialing &&
    subscription.provider !== "stripe" &&
    (subscription.days_remaining ?? 0) <= TRIAL_REMINDER_DAYS
  ) {
    billing = (
      <Banner tone="info" icon={Clock}>
        <span>
          Your free trial ends in {subscription.days_remaining ?? 0}{" "}
          {subscription.days_remaining === 1 ? "day" : "days"}.
        </span>
        <Link href="/settings/billing" className={linkClass}>
          Choose how to pay
        </Link>
      </Banner>
    );
  }

  const unconfirmed = user && user.confirmed === false;

  if (!billing && !unconfirmed) return null;

  return (
    <div>
      {billing}
      {unconfirmed && (
        <Banner tone="info" icon={MailWarning}>
          <span>
            Confirm your email address — we sent a link to <strong>{user.email}</strong>.
          </span>
          {resent ? (
            <span className="text-muted-foreground">Sent. Check your inbox.</span>
          ) : (
            <button
              type="button"
              className={linkClass}
              disabled={resend.isPending}
              onClick={async () => {
                try {
                  await resend.mutateAsync();
                  setResent(true);
                } catch (error) {
                  toast.apiError(error);
                }
              }}
            >
              Resend the link
            </button>
          )}
        </Banner>
      )}
    </div>
  );
}
