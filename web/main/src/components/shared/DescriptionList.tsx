import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type DescriptionItem = {
  label: string;
  value: ReactNode;
  /** Left out entirely — for fields that only apply to some records. */
  hidden?: boolean;
};

/**
 * Label/value pairs for a record.
 *
 * `inline` is the strip under a detail page's status badge (supplier,
 * branch, total…); `rows` is the label-left, value-right list a side sheet
 * reads best as. An empty value renders as "—" so a missing field is visible
 * as missing rather than as a gap.
 */
export function DescriptionList({
  items,
  layout = "rows",
  className,
}: {
  items: DescriptionItem[];
  layout?: "inline" | "rows";
  className?: string;
}) {
  const shown = items.filter((item) => !item.hidden);

  if (layout === "inline") {
    return (
      <dl className={cn("flex flex-wrap gap-x-6 gap-y-1 text-sm", className)}>
        {shown.map((item) => (
          <div key={item.label}>
            <dt className="text-xs text-muted-foreground">{item.label}</dt>
            <dd>{item.value ?? "—"}</dd>
          </div>
        ))}
      </dl>
    );
  }

  return (
    <dl className={cn("divide-y divide-border text-sm", className)}>
      {shown.map((item) => (
        <div key={item.label} className="flex items-start justify-between gap-4 py-2">
          <dt className="shrink-0 text-muted-foreground">{item.label}</dt>
          <dd className="min-w-0 text-right break-words">{item.value ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}
