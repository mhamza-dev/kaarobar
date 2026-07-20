"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, getSession, setSession } from "@/lib/api/client";
import { routes } from "@/lib/navigation";

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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const biz = await api<{ data: Business[] }>("/businesses");
        setBusinesses(biz.data || []);
        const session = getSession();
        if (session && biz.data?.[0] && !session.business_id) {
          const next = { ...session, business_id: biz.data[0].id };
          setSession(next);
          const br = await api<{ data: Branch[] }>(
            `/businesses/${biz.data[0].id}/branches`,
            {},
            next
          );
          setBranches(br.data || []);
          if (br.data?.[0]) {
            setSession({ ...next, branch_id: br.data[0].id });
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-heading">Owner dashboard</h1>
        <p className="text-body">
          Sales, cash, stock alerts, and approvals across your businesses.
        </p>
      </div>

      {error ? (
        <p className="rounded-md border border-warning/30 bg-warning-soft px-3 py-2 text-sm text-warning">
          {error} — make sure the API is running and the database is set up.
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Sales today", value: dashboard?.sales_today ?? "—" },
          { label: "Cash position", value: dashboard?.cash_position ?? "—" },
          { label: "Low stock", value: dashboard?.low_stock_count ?? "—" },
          { label: "Approvals", value: dashboard?.pending_approvals ?? "—" },
        ].map((card) => (
          <div key={card.label} className="rounded-xl border border-border bg-card p-4">
            <div className="text-sm text-body">{card.label}</div>
            <div className="mt-1 text-2xl font-semibold text-heading">{card.value}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-xl border border-border bg-card p-4">
          <h2 className="font-semibold text-heading">Businesses</h2>
          <ul className="mt-3 space-y-2 text-sm text-body">
            {businesses.length === 0 ? (
              <li>No businesses yet.</li>
            ) : (
              businesses.map((b) => <li key={b.id}>{b.name}</li>)
            )}
          </ul>
        </section>
        <section className="rounded-xl border border-border bg-card p-4">
          <h2 className="font-semibold text-heading">Branches</h2>
          <ul className="mt-3 space-y-2 text-sm text-body">
            {branches.length === 0 ? (
              <li>No branches yet.</li>
            ) : (
              branches.map((b) => <li key={b.id}>{b.name}</li>)
            )}
          </ul>
        </section>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link
          href={routes.pos}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground hover:bg-brand-hover"
        >
          Open POS
        </Link>
        <Link
          href={routes.inventory}
          className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold text-heading"
        >
          Inventory
        </Link>
      </div>
    </div>
  );
}
