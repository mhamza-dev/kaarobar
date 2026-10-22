"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { navigation, signInUrl, signUpUrl } from "@/lib/site";

/**
 * The phone-width menu. A disclosure, not a modal: it pushes the page down
 * rather than covering it, so there's no focus to trap. Closes itself on
 * navigation and on Escape.
 */
export function MobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const [openedOn, setOpenedOn] = useState(pathname);

  // Navigating away closes it — tracked by the page it was opened on rather
  // than an effect that resets state after every route change.
  const isOpen = open && openedOn === pathname;

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen]);

  return (
    <div className="md:hidden">
      <button
        type="button"
        className="-mr-2 inline-flex size-10 items-center justify-center rounded-lg text-ink hover:bg-surface-muted"
        aria-expanded={isOpen}
        aria-controls="mobile-menu"
        onClick={() => {
          setOpenedOn(pathname);
          setOpen(!isOpen);
        }}
      >
        <span className="sr-only">{isOpen ? "Close menu" : "Open menu"}</span>
        {isOpen ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
      </button>
      <div
        id="mobile-menu"
        hidden={!isOpen}
        className="absolute inset-x-0 top-full border-b border-line bg-canvas shadow-lg"
      >
        <nav aria-label="Main" className="flex flex-col gap-1 px-4 py-4">
          {navigation.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={pathname === item.href ? "page" : undefined}
              className="rounded-lg px-3 py-2.5 text-base font-medium text-ink hover:bg-surface-muted aria-[current=page]:text-brand-ink"
            >
              {item.label}
            </Link>
          ))}
          <div className="mt-3 grid grid-cols-2 gap-2 border-t border-line pt-4">
            <a
              href={signInUrl()}
              className="flex h-11 items-center justify-center rounded-lg border border-line text-sm font-medium text-ink"
            >
              Sign in
            </a>
            <a
              href={signUpUrl()}
              className="flex h-11 items-center justify-center rounded-lg bg-brand text-sm font-medium text-on-brand"
            >
              Start free trial
            </a>
          </div>
        </nav>
      </div>
    </div>
  );
}
