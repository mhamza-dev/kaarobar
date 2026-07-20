"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { appNav, routes } from "@/lib/navigation";
import { clearSession, getSession, type StoredSession } from "@/lib/api/client";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [session, setSessionState] = useState<StoredSession | null>(null);

  useEffect(() => {
    const current = getSession();
    if (!current) {
      router.replace(routes.login);
      return;
    }
    setSessionState(current);
  }, [router]);

  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg-primary text-body">
        Loading workspace…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-primary text-heading">
      <header className="border-b border-sidebar-border bg-sidebar text-sidebar-foreground">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-6">
            <Link href={routes.app} className="text-lg font-bold tracking-wide text-white">
              Kaarobar
            </Link>
            <nav className="hidden gap-1 md:flex">
              {appNav.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`rounded-md px-3 py-1.5 text-sm ${
                      active ? "bg-sidebar-active text-white" : "text-sidebar-muted hover:bg-sidebar-hover hover:text-white"
                    }`}
                  >
                    {item.title}
                  </Link>
                );
              })}
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-sidebar-muted sm:inline">{session.user.name}</span>
            <button
              type="button"
              className="rounded-md bg-white/10 px-3 py-1.5 text-white hover:bg-white/20"
              onClick={() => {
                clearSession();
                router.push(routes.login);
              }}
            >
              Sign out
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}
