"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { activeSettingsHref, getSettingsSections, SETTINGS_HOME } from "@/lib/settingsNav";
import { cn } from "@/lib/utils";
import { useSessionStore } from "@/stores/sessionStore";

/**
 * Every settings screen sits beside the settings menu — a column on wide
 * screens, a row of chips that scrolls sideways on a phone — so moving
 * between them doesn't mean going back through the sidebar. The overview at
 * /settings has the room to itself.
 */
export default function SettingsLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const scope = useSessionStore((state) => state.scope);

  if (pathname === SETTINGS_HOME) return <>{children}</>;

  const sections = getSettingsSections(scope);
  const active = activeSettingsHref(sections, pathname);

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:gap-10">
      <nav aria-label="Settings" className="lg:w-56 lg:shrink-0">
        {/* Phone and tablet: one scrolling row. */}
        <ul className="scrollbar-thin flex gap-2 overflow-x-auto pb-1 lg:hidden">
          <li className="shrink-0">
            <Link
              href={SETTINGS_HOME}
              className="flex h-8 items-center rounded-full border border-border bg-card px-3 text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              All settings
            </Link>
          </li>
          {sections.flatMap((section) =>
            section.items.map((item) => (
              <li key={item.href} className="shrink-0">
                <Link
                  href={item.href}
                  aria-current={item.href === active ? "page" : undefined}
                  className={cn(
                    "flex h-8 items-center rounded-full border px-3 text-sm font-medium transition-colors",
                    item.href === active
                      ? "border-transparent bg-primary text-primary-foreground"
                      : "border-border bg-card text-muted-foreground hover:text-foreground",
                  )}
                >
                  {item.label}
                </Link>
              </li>
            )),
          )}
        </ul>

        {/* Wide screens: the grouped menu, kept in view while the page scrolls. */}
        <div className="sticky top-0 hidden flex-col gap-5 lg:flex">
          <Link
            href={SETTINGS_HOME}
            className="px-3 text-sm font-semibold text-foreground hover:text-primary"
          >
            Settings
          </Link>
          {sections.map((section) => (
            <div key={section.title} className="flex flex-col gap-0.5">
              <p className="px-3 pb-1.5 text-[0.688rem] font-semibold tracking-wider text-muted-foreground uppercase">
                {section.title}
              </p>
              {section.items.map((item) => {
                const current = item.href === active;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={current ? "page" : undefined}
                    className={cn(
                      "flex h-9 items-center gap-2.5 rounded-lg px-3 text-sm font-medium transition-colors",
                      current
                        ? "bg-card text-foreground shadow-xs ring-1 ring-border"
                        : "text-foreground/70 hover:bg-card/70 hover:text-foreground",
                    )}
                  >
                    <item.icon
                      className={cn(
                        "size-4 shrink-0",
                        current ? "text-primary" : "text-muted-foreground",
                      )}
                    />
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </div>
      </nav>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
