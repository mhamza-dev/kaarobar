"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Gift, Wallet } from "lucide-react";
import { api } from "@/lib/api/client";
import {
  Alert,
  KpiCard,
  StatusBadge,
} from "@/components/app/ui";
import Modal from "@/components/modals/Modal";
import {
  BuyerCard,
  BuyerEmptyPanel,
  BuyerHero,
} from "@/components/buyer/BuyerLayout";
import { BuyerLoyaltySkeleton } from "@/components/buyer/BuyerSkeletons";
import { useT } from "@/lib/i18n";
import { formatDecimal } from "@/lib/decimal";
import { portalKeys } from "@/lib/queryClient";

type LoyaltyRow = {
  business_id: string;
  business_name?: string;
  points: number;
  tier?: { name: string } | null;
  rates: { earn_per_amount: string; points_per_earn: number; redeem_value: string };
};

/** Buyer view of `/app/customers`. */
export default function BuyerLoyalty() {
  const t = useT();
  const [selected, setSelected] = useState<LoyaltyRow | null>(null);

  const loyaltyQuery = useQuery({
    queryKey: portalKeys.loyalty(),
    queryFn: async () => {
      const res = await api<{ data: LoyaltyRow[] }>("/portal/loyalty");
      return Array.isArray(res.data) ? res.data : [];
    },
  });

  const rows = loyaltyQuery.data || [];
  const loading = loyaltyQuery.isLoading;
  const errorMessage =
    loyaltyQuery.error instanceof Error
      ? loyaltyQuery.error.message
      : loyaltyQuery.error
        ? "Failed to load"
        : null;
  const totalPoints = rows.reduce((s, r) => s + (r.points || 0), 0);

  return (
    <div className="space-y-6">
      <BuyerHero
        eyebrow={t("marketplace.eyebrow")}
        title={t("pages.buyerLoyaltyTitle")}
        description={t("pages.buyerLoyaltyDesc")}
        infoKey="page.buyer.loyalty"
      >
        <p className="mt-3">
          <Link
            href="/app/accounting"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:underline"
          >
            <Wallet className="h-4 w-4" />
            {t("marketplace.accountBalance")} →
          </Link>
        </p>
      </BuyerHero>

      {errorMessage ? <Alert tone="error">{errorMessage}</Alert> : null}
      {loading ? (
        <BuyerLoyaltySkeleton />
      ) : rows.length === 0 ? (
        <BuyerEmptyPanel
          icon={<Gift className="h-7 w-7" />}
          title={t("marketplace.emptyLoyaltyTitle")}
          body={t("marketplace.emptyLoyaltyBody")}
          action={
            <Link
              href="/app"
              className="inline-flex rounded-md bg-brand px-5 py-2.5 text-sm font-semibold text-brand-foreground"
            >
              {t("marketplace.browseStores")}
            </Link>
          }
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <KpiCard
              label={t("marketplace.totalPoints")}
              value={totalPoints}
              hint={t("marketplace.acrossStores")}
            />
            <KpiCard
              label={t("marketplace.stores")}
              value={rows.length}
              tone="accent"
            />
          </div>
          <ul className="grid gap-4 sm:grid-cols-2">
            {rows.map((row) => (
              <li key={row.business_id}>
                <button
                  type="button"
                  onClick={() => setSelected(row)}
                  className="w-full text-left"
                >
                  <BuyerCard hover className="p-5">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold text-heading">
                        {row.business_name || t("marketplace.store")}
                      </p>
                      {row.tier ? (
                        <StatusBadge tone="success">{row.tier.name}</StatusBadge>
                      ) : null}
                    </div>
                    <p className="mt-3 text-4xl font-bold tracking-tight text-heading">
                      {row.points}
                    </p>
                    <p className="text-sm text-body">{t("marketplace.points")}</p>
                    <p className="mt-4 text-sm font-medium text-brand">
                      {t("marketplace.viewDetails")} →
                    </p>
                  </BuyerCard>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      <Modal
        isOpen={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.business_name || t("marketplace.store")}
        description={t("marketplace.loyaltyDetailDesc")}
        size="md"
      >
        {selected ? (
          <div className="space-y-5">
            <div className="flex items-center gap-4 rounded-md bg-brand-soft/60 p-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-md bg-brand text-brand-foreground">
                <Gift className="h-6 w-6" />
              </div>
              <div>
                <p className="text-3xl font-bold text-heading">{selected.points}</p>
                <p className="text-sm text-body">{t("marketplace.points")}</p>
              </div>
              {selected.tier ? (
                <StatusBadge tone="success">{selected.tier.name}</StatusBadge>
              ) : null}
            </div>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between gap-4 border-b border-border pb-2">
                <dt className="text-body">{t("marketplace.earnRate")}</dt>
                <dd className="font-semibold text-heading">
                  {selected.rates.points_per_earn} pt / Rs{" "}
                  {selected.rates.earn_per_amount}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-body">{t("marketplace.redeemValue")}</dt>
                <dd className="font-semibold text-heading">
                  Rs {formatDecimal(selected.rates.redeem_value)} / pt
                </dd>
              </div>
            </dl>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
