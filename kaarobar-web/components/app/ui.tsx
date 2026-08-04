"use client";

import type { CSSProperties, ReactNode } from "react";
import Button from "@/components/ui/Button";
import InfoButton from "@/components/ui/InfoButton";
import Tabs, { type TabItem } from "@/components/ui/Tabs";

type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  /** Help topic id, e.g. `page.inventory` — shows (i) next to the title */
  infoKey?: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: ReactNode;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
    icon?: ReactNode;
  };
};

export function PageHeader({
  eyebrow = "Workspace",
  title,
  description,
  infoKey,
  action,
  secondaryAction,
}: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-4 animate-fade-in sm:flex-row sm:items-end sm:justify-between">
      <div>
        <span className="inline-flex rounded-md bg-brand-soft px-3 py-1 text-xs font-semibold tracking-wide text-brand">
          {eyebrow}
        </span>
        <div className="mt-3 flex items-center gap-2.5">
          <h1 className="text-3xl font-bold tracking-tight text-heading">{title}</h1>
          {infoKey ? <InfoButton topicId={infoKey} size="md" /> : null}
        </div>
        {description ? (
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-body">{description}</p>
        ) : null}
      </div>
      {(action || secondaryAction) && (
        <div className="flex flex-wrap gap-2">
          {secondaryAction ? (
            <Button
              variant="outline"
              onClick={secondaryAction.onClick}
              startIcon={secondaryAction.icon}
            >
              {secondaryAction.label}
            </Button>
          ) : null}
          {action ? (
            <Button onClick={action.onClick} startIcon={action.icon}>
              {action.label}
            </Button>
          ) : null}
        </div>
      )}
    </div>
  );
}

/** Page section tabs — underline style (preferred). */
export function TabBar<T extends string>({
  tabs,
  value,
  onChange,
  variant = "underline",
  "aria-label": ariaLabel,
  className,
}: {
  tabs: TabItem<T>[];
  value: T;
  onChange: (id: T) => void;
  variant?: "underline" | "pills";
  "aria-label"?: string;
  className?: string;
}) {
  return (
    <Tabs
      tabs={tabs}
      value={value}
      onChange={onChange}
      variant={variant}
      aria-label={ariaLabel}
      className={className}
    />
  );
}

export function SurfaceCard({
  children,
  className = "",
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div className={`glass-card overflow-hidden ${className}`} style={style}>
      {children}
    </div>
  );
}

export function KpiCard({
  label,
  value,
  hint,
  icon,
  tone = "brand",
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon?: ReactNode;
  tone?: "brand" | "success" | "warning" | "danger" | "accent";
}) {
  const tones = {
    brand: "bg-brand-soft text-brand",
    success: "bg-success-soft text-success",
    warning: "bg-warning-soft text-warning",
    danger: "bg-danger-soft text-danger",
    accent: "bg-accent-soft text-accent",
  }[tone];

  return (
    <SurfaceCard className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-body">{label}</p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-heading">{value}</p>
          {hint ? <p className="mt-2 text-xs font-medium text-muted">{hint}</p> : null}
        </div>
        {icon ? (
          <span
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-md ${tones}`}
          >
            {icon}
          </span>
        ) : null}
      </div>
    </SurfaceCard>
  );
}

export function StatusBadge({
  children,
  tone = "info",
}: {
  children: ReactNode;
  tone?: "info" | "success" | "warning" | "danger";
}) {
  const styles = {
    info: "bg-brand-soft text-brand",
    success: "bg-success-soft text-success",
    warning: "bg-warning-soft text-warning",
    danger: "bg-danger-soft text-danger",
  }[tone];

  return (
    <span
      className={`inline-flex rounded-md px-2.5 py-0.5 text-xs font-semibold ${styles}`}
    >
      {children}
    </span>
  );
}

export function Field({
  label,
  children,
  hint,
  error,
  required,
  className = "",
}: {
  label: string;
  children: ReactNode;
  hint?: string;
  error?: string;
  required?: boolean;
  className?: string;
}) {
  return (
    <label className={`block space-y-2 ${className}`}>
      {label ? (
        <span className="block text-sm font-semibold text-heading">
          {label}
          {required ? <span className="ms-1 text-danger">*</span> : null}
        </span>
      ) : null}
      {children}
      {hint && !error ? <span className="block text-xs text-muted">{hint}</span> : null}
      {error ? <span className="block text-xs text-danger">{error}</span> : null}
    </label>
  );
}

/** Shared control chrome — height matches Select `h-[2.625rem]`. */
export const fieldClass = "glass-field";

export const fieldTextareaClass = "glass-field glass-field-textarea";

export const formSectionTitleClass =
  "text-xs font-bold uppercase tracking-wide text-muted";

export const formGridClass = "grid gap-4 sm:grid-cols-2";

export const formStackClass = "space-y-5";

/** Trigger chrome for Select / SearchSelect — matches glass-field. */
export const fieldTriggerClass =
  "glass-field flex items-center gap-2 text-start hover:border-brand/40 focus:border-brand/45";

export const fieldTriggerSmClass =
  "glass-field !h-9 !min-h-9 rounded-md px-2 text-xs";

export function Alert({
  tone = "info",
  children,
}: {
  tone?: "info" | "error" | "success" | "warning";
  children: ReactNode;
}) {
  const styles = {
    info: "border-brand/20 bg-brand-light text-heading",
    error: "border-danger/30 bg-danger-soft text-danger",
    success: "border-success/30 bg-success-soft text-success",
    warning: "border-warning/40 bg-warning-soft text-warning",
  }[tone];

  return (
    <p className={`rounded-md border px-3 py-2 text-sm ${styles}`}>{children}</p>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="px-6 py-12 text-center">
      <p className="font-semibold text-heading">{title}</p>
      {body ? <p className="mt-1 text-sm text-body">{body}</p> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

