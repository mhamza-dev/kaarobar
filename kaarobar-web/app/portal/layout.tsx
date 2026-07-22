"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { clearPortalSession, getPortalSession } from "@/lib/portal-api";
import KaarobarLogo from "@/components/brand/KaarobarLogo";

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [authed, setAuthed] = useState(false);
  const authPages = ["/portal/login", "/portal/register", "/portal/reset"];

  useEffect(() => {
    setAuthed(Boolean(getPortalSession()?.access_token));
  }, [pathname]);

  function logout() {
    clearPortalSession();
    setAuthed(false);
    router.push("/portal/login");
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-blue-50">
      <header className="border-b border-border/60 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <Link href={authed ? "/portal" : "/portal/login"} className="flex items-center gap-3">
            <KaarobarLogo size={40} className="rounded-[9px] shadow-brand" />
            <div>
              <p className="text-lg font-bold text-heading">Kaarobar</p>
              <p className="text-xs text-body">Customer Portal</p>
            </div>
          </Link>
          {authed && !authPages.includes(pathname) ? (
            <nav className="flex flex-wrap items-center gap-3 text-sm font-semibold text-body">
              <Link href="/portal" className="hover:text-brand">
                Home
              </Link>
              <Link href="/portal/orders" className="hover:text-brand">
                Orders
              </Link>
              <Link href="/portal/loyalty" className="hover:text-brand">
                Loyalty
              </Link>
              <Link href="/portal/ar" className="hover:text-brand">
                Balance
              </Link>
              <Link href="/portal/preferences" className="hover:text-brand">
                Preferences
              </Link>
              <button type="button" onClick={logout} className="text-brand hover:underline">
                Sign out
              </button>
            </nav>
          ) : null}
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  );
}
