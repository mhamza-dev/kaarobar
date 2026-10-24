import { ArrowLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { PageActionsSlot } from "./PageActions";

/**
 * Title/description/actions slot every authenticated screen opens with.
 *
 * A screen about one record passes `back`, the list it came from, which
 * sits above the title. One whose body opens with the record's own name —
 * a customer, a quote, a job — also passes `compact`: the header shrinks to
 * a breadcrumb (the list, then what kind of record this is), so that name
 * is what reads as the page's title.
 */
export function PageHeader({
  eyebrow,
  title,
  documentTitle,
  description,
  actions,
  back,
  compact,
}: {
  eyebrow?: string;
  title: string;
  /**
   * What the browser tab says, when the heading alone wouldn't tell two
   * tabs apart — a sale's receipt number rather than "Sale".
   */
  documentTitle?: string;
  description?: string;
  actions?: ReactNode;
  back?: { href: string; label: string };
  compact?: boolean;
}) {
  // React hoists this into <head>, so every screen names its own tab.
  const tabTitle = <title>{`${documentTitle ?? title} · Kaarobar`}</title>;

  const backLink = back && (
    <Link
      href={back.href}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-md text-sm font-medium text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <ArrowLeft className="size-4" aria-hidden />
      {back.label}
    </Link>
  );

  if (back && compact) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 pb-5">
        {tabTitle}
        <div className="flex min-w-0 items-center gap-2 text-sm">
          {backLink}
          <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/60" aria-hidden />
          <h1 className="truncate font-semibold text-foreground">{title}</h1>
        </div>
        <PageActionsSlot>{actions}</PageActionsSlot>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4 pb-6 md:pb-8">
      {tabTitle}
      <div className="min-w-0">
        {backLink && <div className="mb-3">{backLink}</div>}
        {!backLink && eyebrow && (
          <p className="mb-1.5 flex items-center gap-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-primary" />
            <span className="truncate">{eyebrow}</span>
          </p>
        )}
        <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-[1.75rem]">
          {title}
        </h1>
        {description && (
          <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground md:text-[0.938rem]">
            {description}
          </p>
        )}
      </div>
      <PageActionsSlot>{actions}</PageActionsSlot>
    </div>
  );
}
