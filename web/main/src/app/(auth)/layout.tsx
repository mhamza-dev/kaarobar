"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { useSessionStore } from "@/stores/sessionStore";

/**
 * A signed-in user landing on /login (a stale tab, a bookmarked link) goes
 * straight to the dashboard instead of seeing the login form again — proxy.ts
 * only guards the other direction (unauthenticated → (app)).
 */
export default function AuthLayout({ children }: LayoutProps<"/">) {
  const token = useSessionStore((state) => state.token);
  const router = useRouter();

  useEffect(() => {
    if (token) router.replace("/dashboard");
  }, [token, router]);

  if (token) return null;

  return <>{children}</>;
}
