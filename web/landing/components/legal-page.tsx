import type { ReactNode } from "react";

import { Container } from "@/components/container";

/** Long-form prose for the legal pages: readable line length, real headings. */
export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <Container className="py-16 sm:py-24">
      <article className="mx-auto max-w-3xl">
        <h1 className="text-4xl font-semibold tracking-tight text-ink">{title}</h1>
        <p className="mt-3 text-sm text-ink-muted">Last updated {updated}</p>
        <div className="mt-10 flex flex-col gap-4 text-ink-muted [&_a]:font-medium [&_a]:text-brand-ink [&_a:hover]:underline [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-ink [&_li]:ml-5 [&_li]:list-disc [&_strong]:text-ink [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-2">
          {children}
        </div>
      </article>
    </Container>
  );
}
