"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api/client";

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

  useEffect(() => {
    void api<{ data: LoyaltyRow[] }>("/portal/loyalty")
      .then((res) => setRows(Array.isArray(res.data) ? res.data : []))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"));
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-heading">Loyalty</h1>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {rows.length === 0 ? (
        <p className="text-sm text-body">No loyalty balances yet — order from a store first.</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => (
            <li key={row.business_id} className="rounded-xl border border-border bg-white p-6 shadow-sm">
              <p className="text-sm font-semibold text-brand">{row.business_name}</p>
              <p className="mt-1 text-4xl font-bold text-heading">{row.points}</p>
              <p className="text-body">points</p>
              {row.tier ? (
                <p className="mt-3 text-sm font-semibold text-brand">Tier: {row.tier.name}</p>
              ) : null}
              <p className="mt-4 text-sm text-body">
                Earn {row.rates.points_per_earn} pt per Rs {row.rates.earn_per_amount}. Redeem
                value Rs {row.rates.redeem_value} / pt.
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
