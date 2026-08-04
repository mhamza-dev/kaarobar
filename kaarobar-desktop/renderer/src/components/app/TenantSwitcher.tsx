import { Building2, MapPin } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api, getSession, setSession } from "@/lib/api/client";
import { useT } from "@/lib/i18n";
import Select from "@/components/ui/Select";

type Business = { id: string; name: string; industry?: string };
type Branch = { id: string; name: string; business_id: string };

const triggerClass =
  "max-w-[min(42vw,220px)] border-rail-border bg-card !ps-8 font-semibold hover:bg-rail-hover focus:border-brand/20";

export default function TenantSwitcher() {
  const t = useT();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [businessId, setBusinessId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [loading, setLoading] = useState(true);

  const syncFromSession = useCallback(async () => {
    const session = getSession();
    if (!session) return;
    try {
      const biz = await api<{ data: Business[] }>("/businesses");
      const list = biz.data || [];
      setBusinesses(list);

      const nextBiz = session.business_id || list[0]?.id || "";
      if (!nextBiz) {
        setLoading(false);
        return;
      }
      setBusinessId(nextBiz);

      const scoped = { ...session, business_id: nextBiz };
      const br = await api<{ data: Branch[] }>(
        `/businesses/${nextBiz}/branches`,
        {},
        scoped
      );
      const branchList = br.data || [];
      setBranches(branchList);

      const nextBranch =
        (session.branch_id &&
          branchList.find((b) => b.id === session.branch_id)?.id) ||
        branchList[0]?.id ||
        "";
      setBranchId(nextBranch);

      if (
        session.business_id !== nextBiz ||
        (nextBranch && session.branch_id !== nextBranch)
      ) {
        setSession({
          ...session,
          business_id: nextBiz,
          branch_id: nextBranch || undefined,
        });
      }
    } catch {
      /* header stays usable even if tenant list fails */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    syncFromSession();
    function onSession() {
      const s = getSession();
      if (s?.business_id) setBusinessId(s.business_id);
      if (s?.branch_id) setBranchId(s.branch_id);
    }
    window.addEventListener("kaarobar:session", onSession);
    return () => window.removeEventListener("kaarobar:session", onSession);
  }, [syncFromSession]);

  async function switchBusiness(id: string) {
    const session = getSession();
    if (!session || !id || id === businessId) return;
    setBusinessId(id);
    setBranchId("");
    const next = { ...session, business_id: id, branch_id: undefined };
    setSession(next);
    const br = await api<{ data: Branch[] }>(`/businesses/${id}/branches`, {}, next);
    const list = br.data || [];
    setBranches(list);
    if (list[0]) {
      setBranchId(list[0].id);
      setSession({ ...next, branch_id: list[0].id });
    }
  }

  function switchBranch(id: string) {
    const session = getSession();
    if (!session || !id || id === branchId) return;
    setBranchId(id);
    setSession({ ...session, branch_id: id });
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

  if (loading && !businessId) {
    return (
      <div className="h-9 w-40 animate-pulse rounded-md bg-rail-hover sm:w-72" />
    );
  }

  return (
    <div className="flex min-w-0 items-center gap-2">
      <div className="relative min-w-0">
        <Building2 className="pointer-events-none absolute start-2.5 top-1/2 z-10 h-3.5 w-3.5 -translate-y-1/2 text-rail-muted" />
        <Select
          size="sm"
          className="w-auto max-w-[min(42vw,220px)]"
          value={businessId}
          onChange={(id) => void switchBusiness(id)}
          disabled={businesses.length === 0}
          options={businessOptions}
          aria-label={t("tenant.business")}
          title={t("tenant.business")}
          triggerClassName={triggerClass}
        />
      </div>

      <div className="relative min-w-0">
        <MapPin className="pointer-events-none absolute start-2.5 top-1/2 z-10 h-3.5 w-3.5 -translate-y-1/2 text-rail-muted" />
        <Select
          size="sm"
          className="w-auto max-w-[min(42vw,220px)]"
          value={branchId}
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
