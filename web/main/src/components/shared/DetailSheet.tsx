"use client";

import type { ReactNode } from "react";

import { LoadError } from "@/components/shared/LoadError";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * The side panel a small record opens in over its list — a supplier, a
 * staff member, a batch. Documents with lines and a lifecycle get a full
 * page instead; this is for records you glance at, act on, and close
 * without losing your place in the list.
 *
 * Full-width on a phone, where there's no list worth keeping in view.
 */
export function DetailSheet({
  open,
  onOpenChange,
  title,
  eyebrow,
  description,
  status,
  actions,
  footer,
  loading,
  error,
  onRetry,
  what = "this record",
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Shown once loaded; a placeholder title keeps the dialog labelled meanwhile. */
  title?: string;
  eyebrow?: string;
  description?: string;
  /** A `StatusBadge`, usually. */
  status?: ReactNode;
  /** A `WorkflowActions` bar, or buttons. */
  actions?: ReactNode;
  footer?: ReactNode;
  loading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  /** Finishes "Couldn't load …" when the request fails. */
  what?: string;
  children?: ReactNode;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full gap-0 data-[side=right]:w-full data-[side=right]:sm:max-w-lg"
      >
        <SheetHeader className="border-b border-border pr-12">
          {eyebrow && (
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {eyebrow}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <SheetTitle className="text-lg font-semibold">
              {loading ? "Loading…" : (title ?? "Details")}
            </SheetTitle>
            {!loading && status}
          </div>
          {description && <SheetDescription>{description}</SheetDescription>}
          {!loading && !error && actions && <div className="pt-3">{actions}</div>}
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-4">
          {error ? (
            <LoadError what={what} onRetry={() => onRetry?.()} />
          ) : loading ? (
            <div className="flex flex-col gap-3">
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} className="h-8 w-full" />
              ))}
            </div>
          ) : (
            children
          )}
        </div>

        {footer && !loading && !error && (
          <SheetFooter className="border-t border-border">{footer}</SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}
