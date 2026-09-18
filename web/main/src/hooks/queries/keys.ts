import { useSessionStore } from "@/stores/sessionStore";

/**
 * The tenant segment every domain query key carries.
 *
 * Every list endpoint is scoped by the `X-Business-Id` header the axios
 * interceptor attaches, so two businesses' staff lists are genuinely
 * different resources that must not share a cache entry. Putting the id in
 * the key means switching business re-fetches rather than briefly showing
 * the previous tenant's rows — and it means `BusinessSwitcher` does not
 * have to remember to invalidate anything.
 *
 * Falls back to the organization id (some endpoints are org-scoped, like
 * roles) and finally to `"none"` so the key is never `undefined`.
 */
export function useTenantKey(): string {
  return useSessionStore((state) => {
    const pending = state.pendingSelection;
    return (
      pending?.businessId ??
      state.scope?.business?.id ??
      pending?.organizationId ??
      state.scope?.organization?.id ??
      "none"
    );
  });
}
