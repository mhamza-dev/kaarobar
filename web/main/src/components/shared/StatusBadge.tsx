import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/** The visual families a backend status string can land in. */
export type StatusTone = "neutral" | "success" | "warning" | "danger" | "info";

/**
 * Status strings the backend uses across domains, mapped to a tone once.
 *
 * Central on purpose: the same `draft`/`active`/`void` vocabulary recurs in
 * products, purchase orders, sales and shifts, and a per-screen colour
 * choice would drift between them. A status not listed here falls back to
 * `neutral` rather than throwing — an unmapped status should render plainly,
 * never break the row it sits in.
 */
const STATUS_TONES: Record<string, StatusTone> = {
  active: "success",
  completed: "success",
  received: "success",
  paid: "success",
  approved: "success",
  confirmed: "success",
  open: "info",
  counting: "info",
  dispatched: "info",
  sent: "info",
  awaiting_approval: "warning",
  partially_received: "warning",
  posted: "success",
  draft: "neutral",
  pending: "warning",
  partial: "warning",
  submitted: "warning",
  overdue: "danger",
  cancelled: "danger",
  canceled: "danger",
  void: "danger",
  voided: "danger",
  failed: "danger",
  rejected: "danger",
  suspended: "danger",
  closed: "neutral",
  archived: "neutral",
  inactive: "neutral",
  deleted: "neutral",
};

const TONE_CLASSES: Record<StatusTone, string> = {
  neutral: "bg-muted text-muted-foreground",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-destructive",
  info: "bg-brand-tint text-brand-primary",
};

/** Turns `goods_received` into `Goods received`. */
function humanize(status: string): string {
  const spaced = status.replace(/[_-]+/g, " ").trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function StatusBadge({
  status,
  tone,
  label,
  className,
}: {
  status: string;
  /** Override the mapped tone for a domain where the default reads wrong. */
  tone?: StatusTone;
  /** Override the humanized text, e.g. with a backend-supplied label. */
  label?: string;
  className?: string;
}) {
  const resolved = tone ?? STATUS_TONES[status.toLowerCase()] ?? "neutral";

  return (
    <Badge variant="secondary" className={cn(TONE_CLASSES[resolved], className)}>
      {label ?? humanize(status)}
    </Badge>
  );
}
