"use client";

import { Building2, MapPin } from "lucide-react";
import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, getSession, setSession } from "@/lib/api/client";
import { tenantKeys } from "@/lib/queryClient";
import { useT } from "@/lib/i18n";
import Select from "@/components/ui/Select";

type Business = { id: string; name: string; industry?: string };
type Branch = { id: string; name: string; business_id: string };

const triggerClass =
  "max-w-[min(42vw,220px)] border-rail-border bg-card !ps-8 font-semibold hover:bg-rail-hover focus:border-brand/20";

export default function TenantSwitcher() {
  const t = useT();
  const queryClient = useQueryClient();
  const session = getSession();
  const businessId = session?.business_id || "";
  const branchId = session?.branch_id || "";

  const businessesQuery = useQuery({
    queryKey: tenantKeys.businesses(),
    queryFn: async () => {
      const biz = await api<{ data: Business[] }>("/businesses");
      return biz.data || [];
    },
  });

  const businesses = businessesQuery.data ?? [];
  const resolvedBusinessId = businessId || businesses[0]?.id || "";

  const branchesQuery = useQuery({
    queryKey: tenantKeys.branches(resolvedBusinessId || null),
    enabled: Boolean(resolvedBusinessId),
    queryFn: async () => {
      const s = getSession();
      if (!s || !resolvedBusinessId) return [] as Branch[];
      const scoped = { ...s, business_id: resolvedBusinessId };
      const br = await api<{ data: Branch[] }>(
        `/businesses/${resolvedBusinessId}/branches`,
        {},
        scoped
      );
      return br.data || [];
    },
  });

  const branches = branchesQuery.data ?? [];
  const resolvedBranchId =
    (branchId && branches.find((b) => b.id === branchId)?.id) ||
    branches[0]?.id ||
    "";

  // Keep session aligned with loaded tenant lists.
  useMemo(() => {
    const s = getSession();
    if (!s || !resolvedBusinessId) return;
    if (
      s.business_id !== resolvedBusinessId ||
      (resolvedBranchId && s.branch_id !== resolvedBranchId)
    ) {
      setSession({
        ...s,
        business_id: resolvedBusinessId,
        branch_id: resolvedBranchId || undefined,
      });
    }
  }, [resolvedBusinessId, resolvedBranchId]);

  async function switchBusiness(id: string) {
    const s = getSession();
    if (!s || !id || id === businessId) return;
    const next = { ...s, business_id: id, branch_id: undefined };
    setSession(next);
    await queryClient.invalidateQueries({ queryKey: tenantKeys.branches(id) });
    const br = await api<{ data: Branch[] }>(`/businesses/${id}/branches`, {}, next);
    const list = br.data || [];
    queryClient.setQueryData(tenantKeys.branches(id), list);
    if (list[0]) {
      setSession({ ...next, branch_id: list[0].id });
    }
  }

  function switchBranch(id: string) {
    const s = getSession();
    if (!s || !id || id === branchId) return;
    setSession({ ...s, branch_id: id });
  }

  const businessOptions = useMemo(
    () =>
      businesses.length === 0
        ? [{ value: "", label: t("tenant.noBusinesses") }]
        : businesses.map((b) => ({ value: b.id, label: b.name })),
    [businesses, t]
  );

  const branchOptions = useMemo(
    () =>
      branches.length === 0
        ? [{ value: "", label: t("tenant.noBranches") }]
        : branches.map((b) => ({ value: b.id, label: b.name })),
    [branches, t]
  );

  const loading = businessesQuery.isLoading && !resolvedBusinessId;

  if (loading) {
    return (
      <div className="h-9 w-40 animate-pulse rounded-md bg-rail-hover sm:w-72" />
    );
  }

  return (
    <div className="flex min-w-0 items-center gap-2">
      <div className="relative min-w-0">
        <Building2 className="pointer-events-none absolute start-2.5 top-1/2 z-10 h-3.5 w-3.5 -translate-y-1/2 text-body" />
        <Select
          size="sm"
          className="w-auto max-w-[min(42vw,220px)]"
          value={resolvedBusinessId}
          onChange={(id) => void switchBusiness(id)}
          disabled={businesses.length === 0}
          options={businessOptions}
          aria-label={t("tenant.business")}
          title={t("tenant.business")}
          triggerClassName={triggerClass}
        />
      </div>

      <div className="relative min-w-0">
        <MapPin className="pointer-events-none absolute start-2.5 top-1/2 z-10 h-3.5 w-3.5 -translate-y-1/2 text-body" />
        <Select
          size="sm"
          className="w-auto max-w-[min(42vw,220px)]"
          value={resolvedBranchId}
          onChange={switchBranch}
          disabled={branches.length === 0}
          options={branchOptions}
          aria-label={t("tenant.branch")}
          title={t("tenant.branch")}
          triggerClassName={triggerClass}
        />
      </div>
    </div>
  );
}
