"use client";

import { Building2, ChevronDown, MapPin } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { api, getSession, setSession } from "@/lib/api/client";

type Business = { id: string; name: string; industry?: string };
type Branch = { id: string; name: string; business_id: string };

const selectClass =
  "h-9 max-w-[min(42vw,220px)] appearance-none truncate rounded-md border border-white/10 bg-white/5 py-1.5 pl-8 pr-7 text-xs font-semibold text-white outline-none transition hover:bg-white/10 focus:border-brand focus:ring-1 focus:ring-brand";

export default function TenantSwitcher() {
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
    if (!session || id === businessId) return;
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
    if (!session || id === branchId) return;
    setBranchId(id);
    setSession({ ...session, branch_id: id });
  }

  if (loading && !businessId) {
    return (
      <div className="h-9 w-40 animate-pulse rounded-md bg-white/10 sm:w-72" />
    );
  }

  return (
    <div className="flex min-w-0 items-center gap-2">
      <label className="relative min-w-0">
        <span className="sr-only">Business</span>
        <Building2 className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-sidebar-muted" />
        <select
          className={selectClass}
          value={businessId}
          onChange={(e) => switchBusiness(e.target.value)}
          disabled={businesses.length === 0}
          title="Switch business"
        >
          {businesses.length === 0 ? (
            <option value="">No businesses</option>
          ) : (
            businesses.map((b) => (
              <option key={b.id} value={b.id} className="bg-sidebar text-heading">
                {b.name}
              </option>
            ))
          )}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-sidebar-muted" />
      </label>

      <label className="relative min-w-0">
        <span className="sr-only">Branch</span>
        <MapPin className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-sidebar-muted" />
        <select
          className={selectClass}
          value={branchId}
          onChange={(e) => switchBranch(e.target.value)}
          disabled={branches.length === 0}
          title="Switch branch"
        >
          {branches.length === 0 ? (
            <option value="">No branches</option>
          ) : (
            branches.map((b) => (
              <option key={b.id} value={b.id} className="bg-sidebar text-heading">
                {b.name}
              </option>
            ))
          )}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-sidebar-muted" />
      </label>
    </div>
  );
}
