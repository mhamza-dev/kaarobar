import type { ReactNode } from "react";
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
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
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
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
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
            <Button variant="outline" onClick={secondaryAction.onClick}>
              {secondaryAction.label}
            </Button>
          ) : null}
          {action ? (
            <Button onClick={action.onClick}>{action.label}</Button>
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
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`overflow-hidden rounded-md border border-border bg-card shadow-sm ${className}`}
    >
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
    <SurfaceCard className="p-5 transition hover:-translate-y-0.5 hover:shadow-md">
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
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-heading">{label}</span>
      {children}
    </label>
  );
}

export const fieldClass =
  "w-full rounded-md border border-border bg-bg-secondary px-3 py-2.5 text-sm text-heading outline-none transition placeholder:text-muted focus:border-brand focus:ring-2 focus:ring-brand-soft";

export function Alert({
  tone = "info",
  children,
}: {
  tone?: "info" | "error" | "success";
  children: ReactNode;
}) {
  const styles = {
    info: "border-brand/20 bg-brand-light text-heading",
    error: "border-danger/30 bg-danger-soft text-danger",
    success: "border-success/30 bg-success-soft text-success",
  }[tone];

  return (
    <p className={`rounded-md border px-3 py-2 text-sm ${styles}`}>{children}</p>
  );
}

export function EmptyState({ title, body }: { title: string; body?: string }) {
  return (
    <div className="px-6 py-12 text-center">
      <p className="font-semibold text-heading">{title}</p>
      {body ? <p className="mt-1 text-sm text-body">{body}</p> : null}
    </div>
  );
}

