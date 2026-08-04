"use client";

import type { ReactNode } from "react";
import {
  Ban,
  BookOpen,
  Check,
  Eye,
  Gift,
  Link2,
  Pencil,
  RotateCcw,
  Send,
  Trash2,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export type ActionMenuItem = {
  id: string;
  label: string;
  onClick: () => void;
  icon?: ReactNode;
  tone?: "default" | "danger";
  disabled?: boolean;
  hidden?: boolean;
};

type Props = {
  items: ActionMenuItem[];
  /** @deprecated Kept for call-site compatibility; unused (icons use item labels). */
  label?: string;
  /** @deprecated Kept for call-site compatibility; unused for inline icons. */
  align?: "start" | "end";
  className?: string;
};

/** View is handled by DataTable `onRowClick` — never show as a row icon. */
const ROW_CLICK_IDS = new Set(["view", "detail", "open"]);

const DEFAULT_ICONS: Record<string, LucideIcon> = {
  view: Eye,
  detail: Eye,
  open: Eye,
  edit: Pencil,
  delete: Trash2,
  remove: Trash2,
  deactivate: Ban,
  send: Send,
  ledger: BookOpen,
  khata: Wallet,
  points: Gift,
  "attach-supplier": Link2,
  reverse: RotateCcw,
  receive: Check,
};

const ICON_COLORS: Record<string, string> = {
  edit: "text-sky-600 hover:bg-sky-50 hover:text-sky-700",
  delete: "text-danger hover:bg-danger/10 hover:text-danger",
  remove: "text-danger hover:bg-danger/10 hover:text-danger",
  deactivate: "text-danger hover:bg-danger/10 hover:text-danger",
  ledger: "text-violet-600 hover:bg-violet-50 hover:text-violet-700",
  khata: "text-amber-600 hover:bg-amber-50 hover:text-amber-700",
  points: "text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700",
  send: "text-brand hover:bg-brand-light hover:text-brand",
  "attach-supplier": "text-teal-600 hover:bg-teal-50 hover:text-teal-700",
  reverse: "text-orange-600 hover:bg-orange-50 hover:text-orange-700",
  receive: "text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700",
};

const DEFAULT_COLOR = "text-brand hover:bg-brand-light hover:text-brand";
const DANGER_COLOR = "text-danger hover:bg-danger/10 hover:text-danger";

function resolveItemIcon(item: ActionMenuItem): ReactNode {
  if (item.icon) return item.icon;
  const Icon = DEFAULT_ICONS[item.id];
  if (!Icon) return null;
  return <Icon className="h-4 w-4" strokeWidth={2} aria-hidden />;
}

function colorClass(item: ActionMenuItem): string {
  if (item.tone === "danger") return DANGER_COLOR;
  return ICON_COLORS[item.id] ?? DEFAULT_COLOR;
}

export default function ActionMenu({ items, className = "" }: Props) {
  const visible = items.filter(
    (i) => !i.hidden && !ROW_CLICK_IDS.has(i.id),
  );

  if (visible.length === 0) return null;

  return (
    <div
      className={`inline-flex items-center gap-0.5 ${className}`}
      role="group"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      {visible.map((item) => {
        const icon = resolveItemIcon(item);
        return (
          <button
            key={item.id}
            type="button"
            disabled={item.disabled}
            aria-label={item.label}
            title={item.label}
            className={`inline-flex h-8 w-8 items-center justify-center rounded-md transition focus-visible:outline-none focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-40 ${colorClass(item)}`}
            onClick={() => {
              if (item.disabled) return;
              item.onClick();
            }}
          >
            {icon ?? (
              <span className="text-xs font-semibold leading-none">
                {item.label.slice(0, 1)}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
