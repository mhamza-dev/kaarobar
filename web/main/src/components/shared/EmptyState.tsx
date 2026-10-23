import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * The "nothing here yet" panel every list screen falls back to.
 *
 * Kept distinct from an error state on purpose: an empty list is a normal,
 * often first-run condition, and should offer the action that fills it
 * rather than read as a failure.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-4 px-6 py-14 text-center",
        className,
      )}
    >
      {Icon && (
        <div className="flex size-12 items-center justify-center rounded-2xl bg-accent text-accent-foreground ring-8 ring-accent/40">
          <Icon className="size-5" />
        </div>
      )}
      <div>
        <p className="text-base font-semibold text-foreground">{title}</p>
        {description && (
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}
