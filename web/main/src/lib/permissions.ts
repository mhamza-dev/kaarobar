import type { Scope } from "@/types/api/me";

/**
 * Mirrors `Kaarobar.Scope.can?/2` (backend/lib/backend/scope.ex) exactly:
 * the organization owner bypasses every permission check, regardless of
 * what their role's permission set happens to contain — they can't lock
 * themselves out of their own account. Everyone else needs the key in
 * `scope.permissions`, the flat, already-resolved list `GET /me` returns.
 */
export function can(scope: Scope | null, permission: string): boolean {
  if (!scope) return false;
  if (scope.is_owner) return true;
  return scope.permissions.includes(permission);
}

/** True when the scope holds at least one of the given permissions. */
export function canAny(scope: Scope | null, permissions: string[]): boolean {
  return permissions.some((permission) => can(scope, permission));
}

/** True when the scope holds every one of the given permissions. */
export function canAll(scope: Scope | null, permissions: string[]): boolean {
  return permissions.every((permission) => can(scope, permission));
}
