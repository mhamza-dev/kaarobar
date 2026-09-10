import { useSessionStore } from "@/stores/sessionStore";
import { can, canAll, canAny } from "@/lib/permissions";

/** Reads permission checks off the already-bootstrapped session scope. */
export function usePermission() {
  const scope = useSessionStore((state) => state.scope);

  return {
    can: (permission: string) => can(scope, permission),
    canAny: (permissions: string[]) => canAny(scope, permissions),
    canAll: (permissions: string[]) => canAll(scope, permissions),
    isOwner: scope?.is_owner ?? false,
  };
}
