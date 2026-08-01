"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Store } from "lucide-react";
import { api } from "@/lib/api/client";
import { Alert } from "@/components/app/ui";
import ListingFilters, {
  applyListingFilters,
  emptyListingFilters,
  type ListingFilterState,
} from "@/components/app/ListingFilters";
import { BrandThemeScope } from "@/components/app/BrandTheme";
import {
  BuyerCard,
  BuyerEmptyPanel,
  BuyerHero,
} from "@/components/buyer/BuyerLayout";
import { BuyerDiscoverSkeleton } from "@/components/buyer/BuyerSkeletons";
import { useT } from "@/lib/i18n";

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

/** Buyer home — discover marketplace stores (`/app` when actor=consumer). */
export default function BuyerMarketDiscover() {
  const t = useT();
  const [filters, setFilters] = useState<ListingFilterState>(emptyListingFilters());
  const [businesses, setBusinesses] = useState<Biz[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(true);
      const q = filters.search.trim();
      void api<{ data: Biz[] }>(
        `/marketplace/businesses${q ? `?q=${encodeURIComponent(q)}` : ""}`,
        {},
        null
      )
        .then((res) => {
          setBusinesses(res.data || []);
          setError(null);
        })
        .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"))
        .finally(() => setLoading(false));
    }, 200);
    return () => clearTimeout(timer);
  }, [filters.search]);

  const industryOptions = useMemo(() => {
    const set = new Set<string>();
    for (const b of businesses) {
      if (b.industry?.trim()) set.add(b.industry.trim());
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [businesses]);

  const filtered = useMemo(
    () =>
      applyListingFilters(businesses, { ...filters, search: "" }, {
        searchText: () => "",
        category: (b) => b.industry || "",
      }),
    [businesses, filters]
  );

  return (
    <div className="space-y-8">
      <BuyerHero
        eyebrow={t("marketplace.eyebrow")}
        title={t("pages.discoverTitle")}
        description={t("pages.discoverDesc")}
        infoKey="page.market.discover"
      >
        <p className="mt-3 max-w-xl text-sm text-body">{t("marketplace.discoverHero")}</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href="/app/products"
            className="inline-flex rounded-md bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground shadow-sm transition hover:brightness-110"
          >
            {t("marketplace.browseProducts")}
          </Link>
        </div>
      </BuyerHero>

      <ListingFilters
        value={filters}
        onChange={setFilters}
        categoryOptions={industryOptions}
        categoryLabel={t("marketplace.filterIndustry")}
        showPrice={false}
        searchPlaceholder={t("marketplace.searchStores")}
      />

      {error ? <Alert tone="error">{error}</Alert> : null}

      {loading ? (
        <BuyerDiscoverSkeleton />
      ) : filtered.length === 0 ? (
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
          {filtered.map((b) => {
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
                          style={accent ? { boxShadow: `0 8px 24px ${accent}33` } : undefined}
                        >
                          {b.logo_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={b.logo_url} alt="" className="h-full w-full object-cover" />
                          ) : (
                            (b.name || "?").slice(0, 1).toUpperCase()
                          )}
                        </div>
                        <span className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-card/90 text-brand opacity-0 shadow-sm transition group-hover:opacity-100">
                          <ArrowUpRight className="h-4 w-4" />
                        </span>
                      </div>
                      <div className="flex flex-1 flex-col gap-2 p-5 pt-4">
                        <div className="flex items-start justify-between gap-2">
                          <h2 className="text-lg font-bold tracking-tight text-heading">
                            {b.name}
                          </h2>
                          {!b.logo_url ? (
                            <Store className="mt-1 h-4 w-4 shrink-0 text-muted" />
                          ) : null}
                        </div>
                        {b.tagline ? (
                          <p className="line-clamp-1 text-sm text-body">{b.tagline}</p>
                        ) : null}
                        {b.industry ? (
                          <span
                            className="mt-1 inline-flex w-fit rounded-md px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider"
                            style={
                              accent
                                ? { backgroundColor: `${accent}18`, color: accent }
                                : undefined
                            }
                          >
                            <span className={!accent ? "bg-brand-soft px-0 text-brand" : undefined}>
                              {b.industry}
                            </span>
                          </span>
                        ) : null}
                        {b.marketplace_description ? (
                          <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-body">
                            {b.marketplace_description}
                          </p>
                        ) : null}
                        <span className="mt-auto pt-3 text-sm font-semibold text-brand">
                          {b.appointments_enabled || b.commerce_mode === "appointments"
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
  );
}
