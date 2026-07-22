"use client";

import Link from "next/link";
import { ArrowLeft, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { StatusBadge, SurfaceCard } from "@/components/app/ui";
import Button from "@/components/ui/Button";

type DetailShellProps = {
  backHref: string;
  backLabel?: string;
  eyebrow?: string;
  title: string;
  subtitle?: string;
  status?: { label: string; tone?: "info" | "success" | "warning" | "danger" };
  actions?: ReactNode;
  loading?: boolean;
  error?: string | null;
  children: ReactNode;
};

export function DetailShell({
  backHref,
  backLabel = "Back",
  eyebrow,
  title,
  subtitle,
  status,
  actions,
  loading,
  error,
  children,
}: DetailShellProps) {
  if (loading) {
    return (
      <div className="space-y-4">
        <Link
          href={backHref}
          className="inline-flex items-center gap-2 text-sm font-semibold text-body hover:text-brand"
        >
          <ArrowLeft className="h-4 w-4" />
          {backLabel}
        </Link>
        <p className="text-sm text-body">Loading…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <Link
          href={backHref}
          className="inline-flex items-center gap-2 text-sm font-semibold text-body hover:text-brand"
        >
          <ArrowLeft className="h-4 w-4" />
          {backLabel}
        </Link>
        <SurfaceCard className="p-6">
          <p className="font-semibold text-heading">Couldn’t load this record</p>
          <p className="mt-1 text-sm text-body">{error}</p>
          <div className="mt-4">
            <Link href={backHref}>
              <Button variant="outline">{backLabel}</Button>
            </Link>
          </div>
        </SurfaceCard>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link
            href={backHref}
            className="inline-flex items-center gap-2 text-sm font-semibold text-body hover:text-brand"
          >
            <ArrowLeft className="h-4 w-4" />
            {backLabel}
          </Link>
          {eyebrow ? (
            <p className="mt-3 text-xs font-bold uppercase tracking-[0.14em] text-brand">
              {eyebrow}
            </p>
          ) : null}
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight text-heading">{title}</h1>
            {status ? <StatusBadge tone={status.tone}>{status.label}</StatusBadge> : null}
          </div>
          {subtitle ? <p className="mt-2 max-w-2xl text-sm text-body">{subtitle}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
      {children}
    </div>
  );
}

export function DetailSection({
  title,
  description,
  children,
  className = "",
}: {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <SurfaceCard className={`p-5 ${className}`}>
      <div className="mb-4">
        <h2 className="text-lg font-bold text-heading">{title}</h2>
        {description ? <p className="mt-1 text-sm text-body">{description}</p> : null}
      </div>
      {children}
    </SurfaceCard>
  );
}

export function DetailFieldGrid({
  fields,
}: {
  fields: { label: string; value: ReactNode; icon?: LucideIcon }[];
}) {
  return (
    <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {fields.map((f) => (
        <div key={f.label} className="rounded-md border border-border/70 bg-card-muted/40 px-3 py-2.5">
          <dt className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
            {f.icon ? <f.icon className="h-3.5 w-3.5" /> : null}
            {f.label}
          </dt>
          <dd className="mt-1 text-sm font-semibold text-heading">{f.value ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}
