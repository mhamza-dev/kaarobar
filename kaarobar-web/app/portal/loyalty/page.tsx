"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getPortalSession, portalApi } from "@/lib/portal-api";

export default function PortalLoyaltyPage() {
  const router = useRouter();
  const [data, setData] = useState<{
    points: number;
    tier?: { name: string } | null;
    rates: { earn_per_amount: string; points_per_earn: number; redeem_value: string };
  } | null>(null);

  useEffect(() => {
    if (!getPortalSession()) {
      router.replace("/portal/login");
      return;
    }
    void portalApi<{ data: NonNullable<typeof data> }>("/portal/loyalty")
      .then((res) => setData(res.data))
      .catch(() => router.replace("/portal/login"));
  }, [router]);

  if (!data) return null;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-heading">Loyalty</h1>
      <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
        <p className="text-4xl font-bold text-heading">{data.points}</p>
        <p className="text-body">points</p>
        {data.tier ? (
          <p className="mt-3 text-sm font-semibold text-brand">Tier: {data.tier.name}</p>
        ) : null}
        <p className="mt-4 text-sm text-body">
          Earn {data.rates.points_per_earn} pt per Rs {data.rates.earn_per_amount}. Redeem value Rs{" "}
          {data.rates.redeem_value} / pt.
        </p>
      </div>
    </div>
  );
}
