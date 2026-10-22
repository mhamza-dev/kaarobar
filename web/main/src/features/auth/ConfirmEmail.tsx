"use client";

import { CheckCircle2, XCircle } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef } from "react";

import { AuthShell } from "@/components/shared/AuthShell";
import { buttonVariants } from "@/components/ui/button";
import { useConfirmEmail } from "@/hooks/queries/useAuth";
import { ApiError } from "@/lib/api/errors";
import { useSessionStore } from "@/stores/sessionStore";

/**
 * Spends the token from the confirmation email as soon as the page opens —
 * the click on the link *is* the confirmation, there's nothing to ask.
 *
 * Once only: a token is single-use, so a second request (React's dev-mode
 * double effect, a re-render) would report a confirmed address as an
 * expired link.
 */
export function ConfirmEmail({ token }: { token: string }) {
  const signedIn = useSessionStore((state) => !!state.token);
  const confirm = useConfirmEmail();
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    confirm.mutate(token);
  }, [confirm, token]);

  const next = signedIn
    ? { href: "/dashboard", label: "Go to your dashboard" }
    : { href: "/login", label: "Sign in" };

  if (confirm.isError) {
    const message =
      confirm.error instanceof ApiError
        ? confirm.error.message
        : "This confirmation link couldn't be used.";

    return (
      <AuthShell title="Link not valid">
        <div className="flex flex-col items-center gap-4 text-center">
          <XCircle className="size-10 text-danger" aria-hidden />
          <p className="text-sm text-muted-foreground">{message}</p>
          <p className="text-sm text-muted-foreground">
            {signedIn
              ? "You can send yourself a new link from the banner at the top of the app."
              : "Sign in and you can send yourself a new link."}
          </p>
          <Link href={next.href} className={buttonVariants({ className: "w-full" })}>
            {next.label}
          </Link>
        </div>
      </AuthShell>
    );
  }

  if (confirm.isSuccess) {
    return (
      <AuthShell title="Email confirmed">
        <div className="flex flex-col items-center gap-4 text-center">
          <CheckCircle2 className="size-10 text-success" aria-hidden />
          <p className="text-sm text-muted-foreground">
            Thanks — your email address is confirmed.
          </p>
          <Link href={next.href} className={buttonVariants({ className: "w-full" })}>
            {next.label}
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Confirming your email…">
      <div className="flex justify-center py-4" role="status" aria-label="Confirming">
        <div className="size-6 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary" />
      </div>
    </AuthShell>
  );
}
