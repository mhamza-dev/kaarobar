"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Banknote,
  Boxes,
  CheckCircle2,
  ShoppingCart,
  TrendingUp,
} from "lucide-react";
import { api, getSession, setSession } from "@/lib/api/client";
import { routes } from "@/lib/navigation";
import Button from "@/components/ui/Button";
import {
  Alert,
  KpiCard,
  PageHeader,
  SurfaceCard,
  fieldClass,
} from "@/components/app/ui";

type Business = { id: string; name: string };
type Branch = { id: string; name: string; business_id: string };
type Dashboard = {
  sales_today: string;
  cash_position: string;
  low_stock_count: number;
  pending_approvals: number;
  businesses: number;
  branches: number;
};

export default function AppDashboardPage() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [businessId, setBusinessId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const biz = await api<{ data: Business[] }>("/businesses");
        setBusinesses(biz.data || []);
        const session = getSession();
        const firstBiz = session?.business_id || biz.data?.[0]?.id;
        if (firstBiz) {
          setBusinessId(firstBiz);
          if (session) setSession({ ...session, business_id: firstBiz });
          const br = await api<{ data: Branch[] }>(
            `/businesses/${firstBiz}/branches`,
            {},
            session ? { ...session, business_id: firstBiz } : undefined
          );
          setBranches(br.data || []);
          const firstBranch = session?.branch_id || br.data?.[0]?.id;
          if (firstBranch && session) {
            setBranchId(firstBranch);
            setSession({ ...session, business_id: firstBiz, branch_id: firstBranch });
          }
        }
        const dash = await api<{ data: Dashboard }>("/reports/dashboard");
        setDashboard(dash.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load dashboard");
      }
    }
    load();
  }, []);

  async function switchBusiness(id: string) {
    const session = getSession();
    if (!session) return;
    setBusinessId(id);
    const next = { ...session, business_id: id, branch_id: undefined };
    setSession(next);
    const br = await api<{ data: Branch[] }>(`/businesses/${id}/branches`, {}, next);
    setBranches(br.data || []);
    if (br.data?.[0]) {
      setBranchId(br.data[0].id);
      setSession({ ...next, branch_id: br.data[0].id });
    }
    const dash = await api<{ data: Dashboard }>("/reports/dashboard");
    setDashboard(dash.data);
  }

  function switchBranch(id: string) {
    const session = getSession();
    if (!session) return;
    setBranchId(id);
    setSession({ ...session, branch_id: id });
  }

  const links = [
    {
      href: routes.pos,
      title: "Open POS",
      subtitle: "Checkout & tills",
      icon: ShoppingCart,
      primary: true,
    },
    {
      href: routes.inventory,
      title: "Inventory",
      subtitle: "Stock & purchasing",
      icon: Boxes,
    },
    {
      href: routes.returns,
      title: "Returns",
      subtitle: "Refunds & approvals",
      icon: CheckCircle2,
    },
    {
      href: routes.reports,
      title: "Reports",
      subtitle: "Sales & cash views",
      icon: TrendingUp,
    },
  ] as const;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Overview"
        title="Dashboard"
        description="Sales, cash, stock alerts, and approvals across your businesses."
        action={{
          label: "Open POS",
          onClick: () => {
            window.location.href = routes.pos;
          },
        }}
      />

      {error ? <Alert tone="error">{error}</Alert> : null}

      <SurfaceCard className="p-4 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1.5">
            <span className="text-sm font-medium text-heading">Business</span>
            <select
              className={fieldClass}
              value={businessId}
              onChange={(e) => switchBusiness(e.target.value)}
            >
              {businesses.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1.5">
            <span className="text-sm font-medium text-heading">Branch</span>
            <select
              className={fieldClass}
              value={branchId}
              onChange={(e) => switchBranch(e.target.value)}
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </SurfaceCard>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Sales today"
          value={dashboard?.sales_today ?? "—"}
          hint="Branch take so far"
          tone="brand"
          icon={<TrendingUp className="h-5 w-5" />}
        />
        <KpiCard
          label="Cash position"
          value={dashboard?.cash_position ?? "—"}
          hint="Till & cash accounts"
          tone="success"
          icon={<Banknote className="h-5 w-5" />}
        />
        <KpiCard
          label="Low stock"
          value={dashboard?.low_stock_count ?? "—"}
          hint="Needs reorder attention"
          tone="warning"
          icon={<AlertTriangle className="h-5 w-5" />}
        />
        <KpiCard
          label="Approvals"
          value={dashboard?.pending_approvals ?? "—"}
          hint="Returns waiting on you"
          tone="danger"
          icon={<CheckCircle2 className="h-5 w-5" />}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <SurfaceCard className="p-5 lg:col-span-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-heading">Quick actions</h2>
              <p className="mt-1 text-sm text-body">Jump into the flows you use every day.</p>
            </div>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {links.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`group flex items-center gap-4 rounded-2xl border p-4 transition hover:-translate-y-0.5 hover:shadow-md ${
                    "primary" in item && item.primary
                      ? "border-brand/20 bg-brand text-white shadow-brand"
                      : "border-border bg-card-muted hover:border-brand/30"
                  }`}
                >
                  <span
                    className={`flex h-11 w-11 items-center justify-center rounded-2xl ${
                      "primary" in item && item.primary
                        ? "bg-white/15 text-white"
                        : "bg-brand-soft text-brand"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  <span>
                    <span
                      className={`block font-semibold ${
                        "primary" in item && item.primary ? "text-white" : "text-heading"
                      }`}
                    >
                      {item.title}
                    </span>
                    <span
                      className={`text-sm ${
                        "primary" in item && item.primary ? "text-white/80" : "text-body"
                      }`}
                    >
                      {item.subtitle}
                    </span>
                  </span>
                </Link>
              );
            })}
          </div>
        </SurfaceCard>

        <SurfaceCard className="flex flex-col justify-between p-5">
          <div>
            <h2 className="text-lg font-bold text-heading">Footprint</h2>
            <p className="mt-2 text-sm leading-relaxed text-body">
              Your workspace spans every shop you manage from one login.
            </p>
          </div>
          <div className="mt-6 space-y-3">
            <div className="flex items-center justify-between rounded-2xl bg-bg-tertiary px-4 py-3">
              <span className="text-sm text-body">Businesses</span>
              <strong className="text-lg text-heading">
                {dashboard?.businesses ?? businesses.length}
              </strong>
            </div>
            <div className="flex items-center justify-between rounded-2xl bg-bg-tertiary px-4 py-3">
              <span className="text-sm text-body">Branches</span>
              <strong className="text-lg text-heading">
                {dashboard?.branches ?? branches.length}
              </strong>
            </div>
            <Link href={routes.settings} className="block">
              <Button variant="outline" className="w-full">
                Manage settings
              </Button>
            </Link>
          </div>
        </SurfaceCard>
      </div>
    </div>
  );
}
