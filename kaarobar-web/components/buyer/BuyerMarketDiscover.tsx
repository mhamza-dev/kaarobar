"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api/client";
import {
  Alert,
  EmptyState,
  PageHeader,
  SurfaceCard,
} from "@/components/app/ui";
import ListingFilters, {
  applyListingFilters,
  emptyListingFilters,
  type ListingFilterState,
} from "@/components/app/ListingFilters";
import { BrandThemeScope } from "@/components/app/BrandTheme";
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
};

/** Buyer home — discover marketplace stores (`/app` when actor=consumer). */
export default function BuyerMarketDiscover() {
  const t = useT();
  const [filters, setFilters] = useState<ListingFilterState>(emptyListingFilters());
  const [businesses, setBusinesses] = useState<Biz[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => {
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
    return () => clearTimeout(t);
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
    <div className="space-y-6">
      <PageHeader
        eyebrow={t("marketplace.eyebrow")}
        title={t("pages.discoverTitle")}
        description={t("pages.discoverDesc")}
        infoKey="page.market.discover"
      />
      <ListingFilters
        value={filters}
        onChange={setFilters}
        categoryOptions={industryOptions}
        categoryLabel="Industry"
        showPrice={false}
        searchPlaceholder="Search by name or industry"
      />
      {error ? <Alert tone="error">{error}</Alert> : null}
      {loading && businesses.length === 0 ? (
        <p className="text-sm text-body">Loading stores…</p>
      ) : filtered.length === 0 ? (
        <EmptyState
          title={businesses.length === 0 ? "No stores listed yet" : "No matches"}
          body={
            businesses.length === 0
              ? "When businesses enable the marketplace, they will appear here."
              : "Try another industry chip or search term."
          }
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((b) => {
            const accent = b.primary_color || undefined;
            return (
              <li key={b.id}>
                <BrandThemeScope primaryColor={accent}>
                <Link
                  href={`/app/market/${b.marketplace_slug || b.id}`}
                  className="block h-full transition hover:-translate-y-0.5"
                >
                  <SurfaceCard
                    className="h-full overflow-hidden p-0"
                    style={
                      accent
                        ? { borderTopWidth: 3, borderTopColor: accent }
                        : undefined
                    }
                  >
                    <div
                      className="flex gap-4 p-5"
                      style={
                        accent
                          ? {
                              background: `linear-gradient(120deg, ${accent}12 0%, transparent 50%)`,
                            }
                          : undefined
                      }
                    >
                      <div
                        className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-card-muted text-xl font-bold text-heading shadow-sm"
                        style={accent ? { backgroundColor: `${accent}18` } : undefined}
                      >
                        {b.logo_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={b.logo_url} alt="" className="h-full w-full object-cover" />
                        ) : (
                          (b.name || "?").slice(0, 1).toUpperCase()
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-lg font-bold text-heading">{b.name}</p>
                        {b.tagline ? (
                          <p className="mt-0.5 truncate text-sm text-body">{b.tagline}</p>
                        ) : null}
                        {b.industry ? (
                          <span
                            className="mt-2 inline-block rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                            style={
                              accent
                                ? { backgroundColor: `${accent}22`, color: accent }
                                : undefined
                            }
                          >
                            <span className={!accent ? "text-muted" : undefined}>
                              {b.industry}
                            </span>
                          </span>
                        ) : (
                          <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-muted">
                            store
                          </p>
                        )}
                        {b.marketplace_description ? (
                          <p className="mt-2 line-clamp-2 text-sm text-body">
                            {b.marketplace_description}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </SurfaceCard>
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
