"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { AppShell } from "@/components/shared/AppShell/AppShell";
import { useBrandTheme } from "@/hooks/useBrandTheme";
import { useSessionBootstrap } from "@/hooks/useSessionBootstrap";
import { useSessionStore } from "@/stores/sessionStore";

/**
 * The real authorization boundary — `src/proxy.ts` only does a coarse
 * cookie-presence redirect before this ever renders. `useSessionBootstrap`
 * is what actually proves the token still works, hydrates `sessionStore`
 * with the scope everything else (nav gating, permission checks, the
 * business switcher) reads, and settles on a business to act within.
 */
export default function AppLayout({ children }: LayoutProps<"/">) {
  const router = useRouter();
  const token = useSessionStore((state) => state.token);
  const { isLoading, isError, isReady } = useSessionBootstrap();

  useEffect(() => {
    if (!token) router.replace("/login");
  }, [token, router]);

  useEffect(() => {
    if (isError) router.replace("/login");
  }, [isError, router]);

  useBrandTheme();

  if (!token || isLoading || !isReady) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="size-6 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary" />
      </div>
    );
  }

  return <AppShell>{children}</AppShell>;
}
