"use client";

import { Blocks } from "lucide-react";
import type { ReactNode } from "react";

import { EmptyState } from "@/components/shared/EmptyState";
import { useSessionStore } from "@/stores/sessionStore";

/**
 * Renders a vertical module's screen only when the current business runs
 * that module (`scope.business.modules`, resolved server-side from the
 * business type and the owner's toggles).
 *
 * The nav already hides these routes; this covers the typed URL and the
 * business switcher landing someone on a page the new business doesn't
 * have. The backend refuses those calls regardless — this just says so in
 * words instead of as a list of 403s.
 */
export function RequireModule({ module, children }: { module: string; children: ReactNode }) {
  const modules = useSessionStore((state) => state.scope?.business?.modules);

  if (modules && !modules.includes(module)) {
    return (
      <EmptyState
        icon={Blocks}
        title="Not part of this business"
        description="This screen belongs to a module this business doesn't use. Switch business, or turn the module on in the business settings."
      />
    );
  }

  return <>{children}</>;
}
