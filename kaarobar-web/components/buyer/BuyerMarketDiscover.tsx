"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Package, Store } from "lucide-react";
import { api } from "@/lib/api/client";
import { Alert } from "@/components/app/ui";
import { BrandThemeScope } from "@/components/app/BrandTheme";
import {
  BuyerCard,
  BuyerEmptyPanel,
  BuyerHero,
} from "@/components/buyer/BuyerLayout";
import BuyerProductFeed from "@/components/buyer/BuyerProductFeed";
import { BuyerDiscoverSkeleton } from "@/components/buyer/BuyerSkeletons";
import MarketplaceFilters from "@/components/buyer/MarketplaceFilters";
import { useT } from "@/lib/i18n";
import {
  emptyMarketplaceFeedFilters,
  type MarketplaceFeedFilters,
} from "@/lib/marketplaceFeed";

type Biz = {
  id: string;
  name: string;
  industry?: string | null;
  marketplace_slug?: string | null;
  tagline?: string | null;
  logo_url?: string | null;
  primary_color?: string | null;
  marketplace_description?: string | null;
  appointments_enabled?: boolean;
  commerce_mode?: string | null;
};

type DiscoverMode = "products" | "shops";

/** Buyer home — product-first Discover with optional Shops browse. */
export default function BuyerMarketDiscover() {
  const t = useT();
  const [mode, setMode] = useState<DiscoverMode>("products");
  const [shopFilters, setShopFilters] = useState<MarketplaceFeedFilters>(
    emptyMarketplaceFeedFilters()
  );
  const [businesses, setBusinesses] = useState<Biz[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loadingShops, setLoadingShops] = useState(false);

  useEffect(() => {
    if (mode !== "shops") return;
    const timer = setTimeout(() => {
      setLoadingShops(true);
      const q = shopFilters.search.trim();
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      const qs = params.toString();
      void api<{ data: Biz[] }>(
        `/marketplace/businesses${qs ? `?${qs}` : ""}`,
        {},
        null
      )
        .then((res) => {
          setBusinesses(res.data || []);
          setError(null);
        })
        .catch((err) =>
          setError(err instanceof Error ? err.message : t("common.loadFailed"))
        )
        .finally(() => setLoadingShops(false));
    }, 200);
    return () => clearTimeout(timer);
  }, [mode, shopFilters.search, t]);

  const industryOptions = useMemo(() => {
    const set = new Set<string>();
    for (const b of businesses) {
      if (b.industry?.trim()) set.add(b.industry.trim());
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [businesses]);

  const filteredShops = useMemo(() => {
    if (shopFilters.industries.length === 0) return businesses;
    const selected = new Set(shopFilters.industries);
    // Match shops whose industry is any of the selected values.
    return businesses.filter((b) => {
      const industry = (b.industry ?? "").trim();
      return industry !== "" && selected.has(industry);
    });
  }, [businesses, shopFilters.industries]);

  return (
    <div className="space-y-6">
      <BuyerHero
        eyebrow={t("marketplace.eyebrow")}
        title={t("pages.discoverTitle")}
        description={t("pages.discoverDesc")}
        infoKey="page.market.discover"
      >
        <p className="mt-3 max-w-xl text-sm text-body">
          {t("marketplace.discoverProductsHero")}
        </p>
        <div className="mt-5 inline-flex rounded-md border border-border bg-card p-1 shadow-sm">
          <ModeTab
            active={mode === "products"}
            onClick={() => setMode("products")}
            icon={<Package className="h-3.5 w-3.5" />}
            label={t("marketplace.modeProducts")}
          />
          <ModeTab
            active={mode === "shops"}
            onClick={() => setMode("shops")}
            icon={<Store className="h-3.5 w-3.5" />}
            label={t("marketplace.modeShops")}
          />
        </div>
      </BuyerHero>

      {mode === "products" ? (
        <BuyerProductFeed />
      ) : (
        <div className="space-y-5">
          <MarketplaceFilters
            value={shopFilters}
            onChange={setShopFilters}
            categoryOptions={[]}
            industryOptions={industryOptions}
            resultCount={loadingShops ? undefined : filteredShops.length}
            searchPlaceholder={t("marketplace.searchStores")}
          />

          {error ? <Alert tone="error">{error}</Alert> : null}

          {loadingShops ? (
            <BuyerDiscoverSkeleton />
          ) : filteredShops.length === 0 ? (
            <BuyerEmptyPanel
              icon={<Store className="h-7 w-7" />}
              title={
                businesses.length === 0
                  ? t("marketplace.emptyStoresTitle")
                  : t("common.noResults")
              }
              body={
                businesses.length === 0
                  ? t("marketplace.emptyStoresBody")
                  : t("marketplace.noFilterMatches")
              }
            />
          ) : (
            <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {filteredShops.map((b) => {
                const accent = b.primary_color || undefined;
                return (
                  <li key={b.id}>
                    <BrandThemeScope primaryColor={accent}>
                      <Link
                        href={`/app/market/${b.marketplace_slug || b.id}`}
                        className="group block h-full"
                      >
                        <BuyerCard
                          as="article"
                          hover
                          accent={accent}
                          className="flex h-full flex-col"
                        >
                          <div
                            className="relative flex min-h-[7.5rem] items-end p-5"
                            style={
                              accent
                                ? {
                                    background: `linear-gradient(145deg, ${accent}22 0%, ${accent}08 40%, transparent 70%)`,
                                  }
                                : {
                                    background:
                                      "linear-gradient(145deg, var(--brand-soft) 0%, transparent 70%)",
                                  }
                            }
                          >
                            <div
                              className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-md border border-white/60 bg-card text-xl font-bold text-heading shadow-md"
                              style={
                                accent
                                  ? { boxShadow: `0 8px 24px ${accent}33` }
                                  : undefined
                              }
                            >
                              {b.logo_url ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={b.logo_url}
                                  alt=""
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                (b.name || "?").slice(0, 1).toUpperCase()
                              )}
                            </div>
                            <span className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-card/90 text-brand opacity-0 shadow-sm transition group-hover:opacity-100">
                              <ArrowUpRight className="h-4 w-4" />
                            </span>
                          </div>
                          <div className="flex flex-1 flex-col gap-2 p-5 pt-4">
                            <h2 className="text-lg font-bold tracking-tight text-heading">
                              {b.name}
                            </h2>
                            {b.tagline ? (
                              <p className="line-clamp-1 text-sm text-body">{b.tagline}</p>
                            ) : null}
                            {b.industry ? (
                              <span className="mt-1 inline-flex w-fit rounded-md bg-brand-soft px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-brand">
                                {b.industry}
                              </span>
                            ) : null}
                            <span className="mt-auto pt-3 text-sm font-semibold text-brand">
                              {b.appointments_enabled ||
                              b.commerce_mode === "appointments"
                                ? t("marketplace.bookNow")
                                : t("marketplace.shopNow")}{" "}
                              →
                            </span>
                          </div>
                        </BuyerCard>
                      </Link>
                    </BrandThemeScope>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function ModeTab({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-semibold transition ${
        active
          ? "bg-brand text-brand-foreground shadow-sm"
          : "text-body hover:bg-bg-secondary hover:text-heading"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
