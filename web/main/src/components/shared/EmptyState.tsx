import { Inbox, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * The "nothing here yet" panel every list screen falls back to.
 *
 * Kept distinct from an error state on purpose: an empty list is a normal,
 * often first-run condition, and should offer the action that fills it
 * rather than read as a failure.
 *
 * `size="sm"` is the one-liner for a list inside a card, a tab or a sheet —
 * a quiet icon and a sentence, not a whole first-run panel.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  size = "default",
  className,
}: {
  icon?: LucideIcon;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  size?: "default" | "sm";
  className?: string;
}) {
  const Icon = icon ?? (size === "sm" ? Inbox : undefined);
  const small = size === "sm";

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        small ? "gap-2.5 px-6 py-8" : "gap-4 px-6 py-14",
        className,
      )}
    >
      {Icon &&
        (small ? (
          <div className="flex size-9 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            <Icon className="size-4" aria-hidden />
          </div>
        ) : (
          <div className="flex size-12 items-center justify-center rounded-2xl bg-accent text-accent-foreground ring-8 ring-accent/40">
            <Icon className="size-5" aria-hidden />
          </div>
        ))}
      <div>
        <p
          className={cn(
            "text-foreground",
            small ? "text-sm font-medium" : "text-base font-semibold",
          )}
        >
          {title}
        </p>
        {description && (
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}
