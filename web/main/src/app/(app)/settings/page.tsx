"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/shared/PageHeader";
import { getSettingsSections } from "@/lib/settingsNav";
import { useSessionStore } from "@/stores/sessionStore";

/** Every settings screen this person may open, grouped, with a line on each. */
export default function SettingsPage() {
  const scope = useSessionStore((state) => state.scope);
  const sections = getSettingsSections(scope);

  return (
    <>
      <PageHeader
        eyebrow={scope?.organization?.name}
        title="Settings"
        description="How your organization, people and money are set up — and your own account."
      />
      <div className="flex flex-col gap-8">
        {sections.map((section) => (
          <section key={section.title} className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold text-foreground">{section.title}</h2>
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {section.items.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="group flex h-full items-start gap-3.5 rounded-xl border border-border bg-card p-4 shadow-card transition-colors hover:border-primary/40"
                  >
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                      <item.icon className="size-5" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2 font-semibold text-foreground">
                        {item.label}
                        <ChevronRight
                          className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                          aria-hidden
                        />
                      </span>
                      {item.description && (
                        <span className="mt-0.5 block text-sm text-muted-foreground">
                          {item.description}
                        </span>
                      )}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}
