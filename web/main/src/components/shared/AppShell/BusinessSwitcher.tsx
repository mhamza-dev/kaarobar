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
import { useBusinessesList } from "@/hooks/queries/useBusinesses";
import { cn } from "@/lib/utils";
import { rememberBusiness, useSessionStore } from "@/stores/sessionStore";

/**
 * Switches which business — and, for someone in several, which
 * organization — the session is acting within. New relative to
 * desktop/local (single-shop): state has to live in `sessionStore`, not this
 * component, since `src/lib/api/client.ts`'s axios interceptor reads it too.
 *
 * Switching business matters beyond the name in the corner: modules come
 * with it, so a restaurant's Floor and Kitchen appear and a grocery's
 * purchasing screens go. The choice is remembered per organization so a
 * reload lands back in the same business.
 */
export function BusinessSwitcher({ collapsed }: { collapsed: boolean }) {
  const scope = useSessionStore((state) => state.scope);
  const selectTenant = useSessionStore((state) => state.selectTenant);
  const queryClient = useQueryClient();
  const { data: businesses } = useBusinessesList();

  if (!scope?.organization) return null;

  const organizations = scope.organizations;
  const current = scope.organization;
  const switchable = organizations.length > 1 || (businesses?.length ?? 0) > 1;

  async function switchBusiness(businessId: string) {
    if (businessId === scope?.business?.id) return;
    selectTenant({ organizationId: current.id, businessId });
    rememberBusiness(current.id, businessId);
    await resetTenantQueries();
  }

  /**
   * Every list is scoped by the tenant headers, so nothing cached survives
   * a switch. `resetQueries` rather than `clear`: clearing destroys the
   * `/me` query the layout is subscribed to, and a refetch then fills a new
   * cache entry nobody is watching — the switch "happens" on the wire and
   * never reaches the screen. Resetting keeps the observers attached and
   * refetches whatever is on screen, `/me` included, with the new headers.
   */
  function resetTenantQueries() {
    return queryClient.resetQueries();
  }

  async function switchTo(organizationId: string) {
    if (organizationId === current.id) return;
    selectTenant({ organizationId });
    await resetTenantQueries();
  }

  return (
    <DropdownMenu>
      {/* Base UI composes via `render`, not Radix's `asChild`. */}
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            title={collapsed ? (scope.business?.name ?? current.name) : undefined}
            className={cn(
              "flex w-full items-center gap-2.5 rounded-xl border border-sidebar-border bg-background p-2 text-left text-sm shadow-xs transition-colors outline-none hover:border-input focus-visible:ring-3 focus-visible:ring-ring/50 aria-expanded:border-input dark:bg-white/[0.04]",
              collapsed && "justify-center p-1.5",
            )}
          />
        }
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-linear-to-br from-primary to-brand-primary-active text-sm font-semibold text-primary-foreground shadow-xs">
          {(scope.business?.name ?? current.name).slice(0, 1).toUpperCase()}
        </span>
        {!collapsed && (
          <>
            <span className="min-w-0 flex-1">
              <span className="block truncate leading-tight font-semibold text-sidebar-foreground">
                {scope.business?.name ?? current.name}
              </span>
              <span className="block truncate text-xs leading-tight text-muted-foreground">
                {scope.branch?.name ?? current.name}
              </span>
            </span>
            {switchable && <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />}
          </>
        )}
      </DropdownMenuTrigger>
      {switchable && (
        <DropdownMenuContent align="start" className="w-64">
          {(businesses?.length ?? 0) > 1 && (
            <>
              {/* Base UI requires GroupLabel to sit inside a Group. */}
              <DropdownMenuGroup>
                <DropdownMenuLabel>Switch business</DropdownMenuLabel>
                {businesses!.map((business) => (
                  <DropdownMenuItem key={business.id} onClick={() => switchBusiness(business.id)}>
                    <span className="flex-1 truncate">{business.name}</span>
                    {business.id === scope.business?.id && (
                      <Check className="size-4 text-primary" />
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
            </>
          )}
          {organizations.length > 1 && (
            <>
              {(businesses?.length ?? 0) > 1 && <DropdownMenuSeparator />}
              <DropdownMenuGroup>
                <DropdownMenuLabel>Switch organization</DropdownMenuLabel>
                {organizations.map((org) => (
                  <DropdownMenuItem key={org.id} onClick={() => switchTo(org.id)}>
                    <span className="flex-1 truncate">{org.name}</span>
                    {org.id === current.id && <Check className="size-4 text-primary" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
            </>
          )}
        </DropdownMenuContent>
      )}
    </DropdownMenu>
  );
}
