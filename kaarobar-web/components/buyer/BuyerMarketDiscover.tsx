"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api/client";

type Biz = {
  id: string;
  name: string;
  industry?: string | null;
  marketplace_slug?: string | null;
};

/** Buyer home — discover marketplace stores (`/app` when actor=buyer). */
export default function BuyerMarketDiscover() {
  const [q, setQ] = useState("");
  const [businesses, setBusinesses] = useState<Biz[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      void api<{ data: Biz[] }>(
        `/marketplace/businesses${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ""}`,
        {},
        null
      )
        .then((res) => {
          setBusinesses(res.data || []);
          setError(null);
        })
        .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"));
    }, 200);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-heading">Discover stores</h1>
        <p className="mt-2 text-body">Browse Kaarobar businesses and place pickup orders.</p>
      </div>
      <input
        className="w-full max-w-md rounded-md border border-border bg-white px-3 py-2 text-sm"
        placeholder="Search by name or industry"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <ul className="grid gap-3 sm:grid-cols-2">
        {businesses.length === 0 ? (
          <li className="text-sm text-body">No marketplace stores listed yet.</li>
        ) : (
          businesses.map((b) => (
            <li key={b.id}>
              <Link
                href={`/app/market/${b.marketplace_slug || b.id}`}
                className="block rounded-xl border border-border bg-white p-5 shadow-sm transition hover:border-brand/40"
              >
                <p className="text-lg font-bold text-heading">{b.name}</p>
                <p className="mt-1 text-sm capitalize text-body">{b.industry || "store"}</p>
              </Link>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
