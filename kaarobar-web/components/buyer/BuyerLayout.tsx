"use client";

import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/app/ui";

/** Shared marketplace page hero — gradient card + PageHeader. */
export function BuyerHero({
  title,
  description,
  infoKey,
  eyebrow,
  children,
  action,
  accent,
}: {
  title: string;
  description?: string;
  infoKey?: string;
  eyebrow?: string;
  children?: ReactNode;
  action?: { label: string; onClick: () => void };
  accent?: string | null;
}) {
  return (
    <div
      className="relative overflow-hidden rounded-md border border-border bg-card"
      style={
        accent
          ? { borderTopWidth: 4, borderTopColor: accent }
          : undefined
      }
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-90"
        style={
          accent
            ? {
                background: `radial-gradient(ellipse 80% 60% at 10% 0%, ${accent}22 0%, transparent 55%), radial-gradient(ellipse 50% 40% at 90% 20%, ${accent}14 0%, transparent 50%)`,
              }
            : {
                background:
                  "radial-gradient(ellipse 80% 60% at 10% 0%, color-mix(in srgb, var(--brand) 18%, transparent), transparent 55%), radial-gradient(ellipse 50% 40% at 90% 20%, color-mix(in srgb, var(--brand) 10%, transparent), transparent 50%)",
              }
        }
      />
      <div className="relative px-6 py-8 sm:px-8 sm:py-10">
        <PageHeader
          eyebrow={eyebrow}
          title={title}
          description={description}
          infoKey={infoKey}
          action={action}
        />
        {children}
      </div>
    </div>
  );
}

/** Larger marketplace surface card. */
export function BuyerCard({
  children,
  className = "",
  hover = false,
  accent,
  as: Tag = "div",
  style,
}: {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  accent?: string | null;
  as?: "div" | "article" | "li" | "section";
  style?: CSSProperties;
}) {
  const accentStyle: CSSProperties | undefined = accent
    ? { borderTopWidth: 3, borderTopColor: accent, ...style }
    : style;

  return (
    <Tag
      className={`overflow-hidden rounded-md border border-border bg-card shadow-sm ${
        hover
          ? "transition duration-200 hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-lg"
          : ""
      } ${className}`}
      style={accentStyle}
    >
      {children}
    </Tag>
  );
}

/** Consistent empty / no-results panel for buyer lists. */
export function BuyerEmptyPanel({
  title,
  body,
  icon,
  action,
}: {
  title: string;
  body?: string;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-md border border-dashed border-brand/30 bg-gradient-to-b from-brand-light/60 to-card px-6 py-12 text-center">
      {icon ? (
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-md bg-brand text-brand-foreground shadow-brand">
          {icon}
        </div>
      ) : null}
      <h3 className="text-lg font-bold text-heading">{title}</h3>
      {body ? <p className="mx-auto mt-2 max-w-md text-sm text-body">{body}</p> : null}
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function BuyerBackLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:underline"
    >
      <ArrowLeft className="h-4 w-4" />
      {children}
    </Link>
  );
}

export function formatMarketplacePrice(price?: string | number | null): string {
  const n = Number(price || 0);
  return Number.isFinite(n) ? n.toFixed(2) : "0.00";
}

export function marketplaceProductCategory(p: {
  category?: string | null;
  category_ref?: { name?: string | null } | null;
}): string {
  return p.category_ref?.name || p.category || "Uncategorized";
}
