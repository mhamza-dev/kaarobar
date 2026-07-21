"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api/client";
import { PageHeader, SurfaceCard } from "@/components/app/ui";
import { useToast } from "@/components/ui/Toast";
import { useT } from "@/lib/i18n";

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
  const t = useT();
  const toast = useToast();
  const [usage, setUsage] = useState<Usage | null>(null);
  const [businesses, setBusinesses] = useState<Business[]>([]);

  const load = useCallback(async () => {
    try {
      const [bill, biz] = await Promise.all([
        api<{ data: Usage }>("/billing/subscription"),
        api<{ data: Business[] }>("/businesses"),
      ]);
      setUsage(bill.data);
      setBusinesses(biz.data || []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("settings.loadFailed"));
    }
  }, [t, toast]);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleFbr(b: Business) {
    try {
      await api(`/businesses/${b.id}`, {
        method: "PATCH",
        body: JSON.stringify({ fbr_tier1: !b.fbr_tier1 }),
      });
      toast.success(
        t(!b.fbr_tier1 ? "settings.fbrEnabled" : "settings.fbrDisabled", {
          name: b.name,
        })
      );
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.updateFailed"));
    }
  }

  const sub = usage?.subscription;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t("common.workspace")}
        title={t("pages.settingsTitle")}
        description={t("pages.settingsDesc")}
      />

      {sub ? (
        <SurfaceCard className="p-5">
          <h2 className="font-semibold text-heading">{t("settings.subscription")}</h2>
          <p className="mt-1 text-body">
            {t("settings.plan")}{" "}
            <strong className="text-heading">{sub.plan}</strong> · {sub.status}
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {(
              [
                [t("settings.businesses"), usage!.usage.businesses, usage!.limits.max_businesses],
                [t("settings.branches"), usage!.usage.branches, usage!.limits.max_branches],
                [t("settings.users"), usage!.usage.users, usage!.limits.max_users],
              ] as const
            ).map(([label, used, max]) => (
              <div key={label} className="rounded-md border border-border bg-card-muted p-3">
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
              className="mt-4 inline-block rounded-md bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground"
            >
              {t("settings.manageBilling")}
            </a>
          ) : (
            <p className="mt-4 text-sm text-body">{t("settings.billingNotConfigured")}</p>
          )}
        </SurfaceCard>
      ) : null}

      <SurfaceCard className="flex flex-col p-5">
        <h2 className="shrink-0 font-semibold text-heading">{t("settings.fbrTitle")}</h2>
        <p className="mt-1 shrink-0 text-sm text-body">{t("settings.fbrDesc")}</p>
        <ul className="mt-4 max-h-[min(28rem,50vh)] space-y-0 overflow-y-auto">
          {businesses.map((b) => (
            <li
              key={b.id}
              className="flex flex-wrap items-center justify-between gap-2 border-t border-border py-3 first:border-t-0"
            >
              <span className="font-medium text-heading">{b.name}</span>
              <button
                type="button"
                onClick={() => toggleFbr(b)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                  b.fbr_tier1
                    ? "bg-brand text-brand-foreground"
                    : "border border-border text-heading hover:bg-bg-hover"
                }`}
              >
                {b.fbr_tier1 ? t("common.enabled") : t("common.disabled")}
              </button>
            </li>
          ))}
        </ul>
      </SurfaceCard>
    </div>
  );
}
