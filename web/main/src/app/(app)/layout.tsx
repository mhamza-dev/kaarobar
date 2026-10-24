"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { AppShell } from "@/components/shared/AppShell/AppShell";
import { LogoMark } from "@/components/shared/LogoMark";
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
      <div
        role="status"
        className="flex h-dvh flex-col items-center justify-center gap-5 bg-sidebar"
      >
        <title>Kaarobar</title>
        <LogoMark className="size-11 animate-pulse" />
        <div className="h-1 w-32 overflow-hidden rounded-full bg-border">
          <div className="h-full w-1/3 animate-loading-bar rounded-full bg-primary" />
        </div>
        <span className="sr-only">Loading Kaarobar…</span>
      </div>
    );
  }

  return <AppShell>{children}</AppShell>;
}
