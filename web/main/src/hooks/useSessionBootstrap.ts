"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";

import { useMe } from "@/hooks/queries/useMe";
import { listBusinesses } from "@/services/businesses";
import { rememberedBusiness, useSessionStore } from "@/stores/sessionStore";

/**
 * Brings a fresh session up to a usable tenant context.
 *
 * `GET /me` resolves the organization on its own when the user belongs to
 * exactly one (`Kaarobar.Scopes.resolve_tenant/2`), but it never picks a
 * *business* — that comes from the `X-Business-Id` header, which a
 * just-registered client has no way to know yet. Without this step the app
 * loads with `scope.business === null`: no business name in the shell, and
 * every module-gated nav item hidden, because module gating reads
 * `scope.business.modules`.
 *
 * So: once an organization is known and no business is selected, fetch the
 * organization's businesses and adopt one — the one this browser last used
 * (`rememberBusiness`, written by the switcher) if it's still listed, else
 * the first — then let `/me` resolve again with the header attached.
 */
export function useSessionBootstrap() {
  const token = useSessionStore((state) => state.token);
  const setScope = useSessionStore((state) => state.setScope);
  const selectTenant = useSessionStore((state) => state.selectTenant);

  const me = useMe({ enabled: !!token });
  const scope = me.data;
  const needsBusiness = !!scope?.organization && !scope.business;

  // Kept in the store, not local state: it has to survive the `/me` refetch
  // adoption triggers. One attempt per session — if re-resolving `/me` with
  // the header still comes back without a business, render anyway rather
  // than spin, since an organization with no businesses yet is a real state
  // and a backend that refuses the id is a bug to surface, not to retry.
  const adoptionAttempted = useSessionStore((state) => state.businessAdoptionAttempted);
  const markAdoptionAttempted = useSessionStore((state) => state.markBusinessAdoptionAttempted);

  const businesses = useQuery({
    queryKey: ["businesses", "bootstrap", scope?.organization?.id],
    queryFn: listBusinesses,
    enabled: needsBusiness && !adoptionAttempted,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (scope) setScope(scope);
  }, [scope, setScope]);

  useEffect(() => {
    if (!needsBusiness || adoptionAttempted || !businesses.isSuccess) return;

    markAdoptionAttempted();

    const remembered = rememberedBusiness(scope!.organization!.id);
    const target =
      businesses.data?.find((business) => business.id === remembered) ?? businesses.data?.[0];
    if (!target) return;

    selectTenant({ businessId: target.id });
    void me.refetch();
    // `me` is deliberately not a dependency: refetching is the effect, and
    // the query object's identity changes on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    needsBusiness,
    adoptionAttempted,
    businesses.isSuccess,
    businesses.data,
    selectTenant,
    markAdoptionAttempted,
  ]);

  const adopting = needsBusiness && !adoptionAttempted;

  return {
    isLoading: me.isLoading || adopting,
    isError: me.isError,
    isReady: me.isSuccess && !adopting,
  };
}
