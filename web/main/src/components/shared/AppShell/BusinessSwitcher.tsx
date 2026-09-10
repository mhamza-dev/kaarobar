"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Check, ChevronsUpDown } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { meQueryKey, useMe } from "@/hooks/queries/useMe";
import { useSessionStore } from "@/stores/sessionStore";

/**
 * Switches which organization the session is acting within. New relative to
 * desktop/local (single-shop): state has to live in `sessionStore`, not this
 * component, since `src/lib/api/client.ts`'s axios interceptor reads it too.
 *
 * Business/branch switching within one organization is deferred until a
 * screen actually needs it (multi-business owners are the common case this
 * ships for; multi-branch-within-one-business picking follows in a later
 * phase alongside the register/POS work that needs it most).
 */
export function BusinessSwitcher({ collapsed }: { collapsed: boolean }) {
  const scope = useSessionStore((state) => state.scope);
  const selectTenant = useSessionStore((state) => state.selectTenant);
  const queryClient = useQueryClient();
  const { refetch } = useMe({ enabled: false });

  if (!scope?.organization) return null;

  const organizations = scope.organizations;
  const current = scope.organization;

  async function switchTo(organizationId: string) {
    if (organizationId === current.id) return;
    selectTenant({ organizationId });
    queryClient.removeQueries({ queryKey: meQueryKey });
    // Every list in the app is tenant-scoped — nothing cached under the old
    // organization is valid once the switch takes effect.
    queryClient.clear();
    await refetch();
  }

  return (
    <DropdownMenu>
      {/* Base UI composes via `render`, not Radix's `asChild`. */}
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-lg border border-sidebar-border bg-sidebar px-2.5 py-2 text-left text-sm hover:bg-sidebar-accent/60"
          />
        }
      >
        <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary text-xs font-semibold text-primary-foreground">
          {current.name.slice(0, 1).toUpperCase()}
        </span>
        {!collapsed && (
          <>
            <span className="flex-1 truncate font-medium text-sidebar-foreground">
              {scope.business?.name ?? current.name}
            </span>
            {organizations.length > 1 && (
              <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" />
            )}
          </>
        )}
      </DropdownMenuTrigger>
      {organizations.length > 1 && (
        <DropdownMenuContent align="start" className="w-64">
          {/* Base UI requires GroupLabel to sit inside a Group. */}
          <DropdownMenuGroup>
            <DropdownMenuLabel>Switch organization</DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          {organizations.map((org) => (
            <DropdownMenuItem key={org.id} onClick={() => switchTo(org.id)}>
              <span className="flex-1 truncate">{org.name}</span>
              {org.id === current.id && <Check className="size-4 text-primary" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      )}
    </DropdownMenu>
  );
}
