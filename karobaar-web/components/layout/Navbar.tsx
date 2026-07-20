"use client";

import NextLink from "next/link";
import { Menu, X } from "lucide-react";
import { useState } from "react";

import Link from "@/components/ui/Link";
import {
  companyNav,
  landingNav,
  navbarCompanyNav,
  routes,
} from "@/lib/navigation";

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  const closeMobile = () => setMobileOpen(false);

  return (
    <header className="sticky top-0 z-50 border-b border-border/50 glass">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6">
        <NextLink href={routes.home} className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-gradient text-lg font-bold text-white shadow-brand">
            K
          </div>

          <div>
            <h1 className="text-xl font-bold text-heading">Kaarobar</h1>
            <p className="text-xs text-body">AI Business Operating System</p>
          </div>
        </NextLink>

        <nav className="hidden items-center gap-7 lg:flex">
          {landingNav.map((item) => (
            <Link key={item.title} href={item.href} variant="nav">
              {item.title}
            </Link>
          ))}

          <div className="h-4 w-px bg-border" />

          {navbarCompanyNav.map((item) => (
            <Link key={item.title} href={item.href} variant="nav">
              {item.title}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <Link href={routes.login} variant="ghost">
            Login
          </Link>

          <Link href={routes.signup}>Start Free Trial</Link>
        </div>

        <button
          type="button"
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          onClick={() => setMobileOpen((open) => !open)}
          className="rounded-lg p-2 lg:hidden"
        >
          {mobileOpen ? (
            <X className="h-6 w-6 text-heading" />
          ) : (
            <Menu className="h-6 w-6 text-heading" />
          )}
        </button>
      </div>

      {mobileOpen && (
        <div className="border-t border-border bg-bg-secondary lg:hidden">
          <div className="space-y-1 px-6 py-6">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">
              Product
            </p>
            {landingNav.map((item) => (
              <NextLink
                key={item.title}
                href={item.href}
                onClick={closeMobile}
                className="block rounded-lg px-3 py-2.5 text-body transition hover:bg-bg-hover hover:text-brand"
              >
                {item.title}
              </NextLink>
            ))}

            <p className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wider text-muted">
              Company
            </p>
            {companyNav.map((item) => (
              <NextLink
                key={item.title}
                href={item.href}
                onClick={closeMobile}
                className="block rounded-lg px-3 py-2.5 text-body transition hover:bg-bg-hover hover:text-brand"
              >
                {item.title}
              </NextLink>
            ))}

            <div className="mt-5 flex flex-col gap-3">
              <Link
                href={routes.login}
                variant="ghost"
                fullWidth
                onClick={closeMobile}
              >
                Login
              </Link>

              <Link href={routes.signup} fullWidth onClick={closeMobile}>
                Start Free Trial
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
