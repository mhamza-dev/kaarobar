"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

import { useSessionStore } from "@/stores/sessionStore";

/**
 * A signed-in user landing on /login (a stale tab, a bookmarked link) goes
 * straight to the dashboard instead of seeing the login form again — proxy.ts
 * only guards the other direction (unauthenticated → (app)).
 *
 * A flow that knows better sets `afterSignIn` before adopting the token —
 * registration sends a new owner to `/welcome` — and that wins, once.
 *
 * Otherwise, a signed-in visitor sent to `/register?plan=…` by the pricing page:
 * they already have an account, so the plan they clicked opens on the
 * billing screen instead. Read from `window.location` rather than
 * `useSearchParams`, which would need a Suspense boundary around every
 * auth page for the sake of this one redirect.
 */
export default function AuthLayout({ children }: LayoutProps<"/">) {
  const token = useSessionStore((state) => state.token);
  const router = useRouter();
  const pathname = usePathname();
  // Once per token. Clearing `afterSignIn` below would otherwise re-run this
  // while the URL still says `/register?plan=…`, and the second redirect
  // would overtake the first.
  const redirected = useRef(false);

  useEffect(() => {
    if (!token || redirected.current) return;
    redirected.current = true;

    // Read rather than subscribed to, for the same reason.
    const { afterSignIn, setAfterSignIn } = useSessionStore.getState();
    if (afterSignIn) {
      setAfterSignIn(null);
      router.replace(afterSignIn);
      return;
    }

    const plan =
      pathname === "/register" ? new URLSearchParams(window.location.search).get("plan") : null;
    router.replace(plan ? `/settings/billing?plan=${encodeURIComponent(plan)}` : "/dashboard");
  }, [token, router, pathname]);

  if (token) return null;

  return <>{children}</>;
}
