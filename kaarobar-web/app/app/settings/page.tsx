"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api/client";

type Usage = {
  subscription: {
    plan: string;
    status: string;
    max_businesses: number;
    max_branches: number;
    max_users: number;
    trial_ends_at?: string;
    current_period_end?: string;
  };
  usage: { businesses: number; branches: number; users: number };
  limits: { max_businesses: number; max_branches: number; max_users: number };
  checkout_url?: string | null;
};

type Business = { id: string; name: string; fbr_tier1?: boolean };

export default function SettingsPage() {
  const [usage, setUsage] = useState<Usage | null>(null);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [bill, biz] = await Promise.all([
        api<{ data: Usage }>("/billing/subscription"),
        api<{ data: Business[] }>("/businesses"),
      ]);
      setUsage(bill.data);
      setBusinesses(biz.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load settings");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleFbr(b: Business) {
    try {
      await api(`/businesses/${b.id}`, {
        method: "PATCH",
        body: JSON.stringify({ fbr_tier1: !b.fbr_tier1 }),
      });
      setMessage(`FBR Tier-1 ${!b.fbr_tier1 ? "enabled" : "disabled"} for ${b.name}`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    }
  }

  const sub = usage?.subscription;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-heading">Settings</h1>
        <p className="text-body">Plan limits, billing, and FBR reporting flags.</p>
      </div>

      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      {message ? <p className="text-sm text-body">{message}</p> : null}

      {sub ? (
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="font-semibold text-heading">Subscription</h2>
          <p className="mt-1 text-body">
            Plan <strong className="text-heading">{sub.plan}</strong> · {sub.status}
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {(
              [
                ["Businesses", usage!.usage.businesses, usage!.limits.max_businesses],
                ["Branches", usage!.usage.branches, usage!.limits.max_branches],
                ["Users", usage!.usage.users, usage!.limits.max_users],
              ] as const
            ).map(([label, used, max]) => (
              <div key={label} className="rounded-lg border border-border p-3">
                <p className="text-sm text-body">{label}</p>
                <p className="text-lg font-semibold text-heading">
                  {used} / {max}
                </p>
              </div>
            ))}
          </div>
          {usage?.checkout_url ? (
            <a
              href={usage.checkout_url}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-block rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground"
            >
              Manage billing
            </a>
          ) : (
            <p className="mt-4 text-sm text-body">
              Checkout URL not configured (`LEMONSQUEEZY_CHECKOUT_URL`).
            </p>
          )}
        </div>
      ) : null}

      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="font-semibold text-heading">FBR Tier-1</h2>
        <p className="mt-1 text-sm text-body">
          When enabled, completed sales enqueue an async FBR report and store invoice + QR payload on the receipt.
        </p>
        <ul className="mt-4 space-y-2">
          {businesses.map((b) => (
            <li
              key={b.id}
              className="flex flex-wrap items-center justify-between gap-2 border-t border-border py-3 first:border-t-0"
            >
              <span className="text-heading">{b.name}</span>
              <button
                type="button"
                onClick={() => toggleFbr(b)}
                className={`rounded-lg px-3 py-1.5 text-sm ${
                  b.fbr_tier1
                    ? "bg-brand text-brand-foreground"
                    : "border border-border text-heading"
                }`}
              >
                {b.fbr_tier1 ? "Enabled" : "Disabled"}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
