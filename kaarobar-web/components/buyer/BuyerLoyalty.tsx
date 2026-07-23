"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api/client";
import {
  Alert,
  EmptyState,
  KpiCard,
  PageHeader,
  StatusBadge,
  SurfaceCard,
} from "@/components/app/ui";

type LoyaltyRow = {
  business_id: string;
  business_name?: string;
  points: number;
  tier?: { name: string } | null;
  rates: { earn_per_amount: string; points_per_earn: number; redeem_value: string };
};

/** Buyer view of `/app/customers`. */
export default function BuyerLoyalty() {
  const [rows, setRows] = useState<LoyaltyRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void api<{ data: LoyaltyRow[] }>("/portal/loyalty")
      .then((res) => setRows(Array.isArray(res.data) ? res.data : []))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  const totalPoints = rows.reduce((s, r) => s + (r.points || 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Marketplace"
        title="Loyalty"
        description="Points and tiers across stores you shop with."
      />
      {error ? <Alert tone="error">{error}</Alert> : null}
      {loading ? (
        <p className="text-sm text-body">Loading loyalty…</p>
      ) : rows.length === 0 ? (
        <EmptyState
          title="No loyalty balances yet"
          body="Order from a store to start earning points."
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <KpiCard label="Total points" value={totalPoints} hint="Across all stores" />
            <KpiCard label="Stores" value={rows.length} tone="accent" />
          </div>
          <ul className="grid gap-4 sm:grid-cols-2">
            {rows.map((row) => (
              <li key={row.business_id}>
                <SurfaceCard className="p-5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-heading">{row.business_name || "Store"}</p>
                    {row.tier ? <StatusBadge tone="success">{row.tier.name}</StatusBadge> : null}
                  </div>
                  <p className="mt-3 text-4xl font-bold tracking-tight text-heading">
                    {row.points}
                  </p>
                  <p className="text-sm text-body">points</p>
                  <p className="mt-4 text-sm text-body">
                    Earn {row.rates.points_per_earn} pt per Rs {row.rates.earn_per_amount}.
                    Redeem value Rs {row.rates.redeem_value} / pt.
                  </p>
                </SurfaceCard>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
