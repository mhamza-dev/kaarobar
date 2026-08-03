"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Package } from "lucide-react";
import { api } from "@/lib/api/client";
import { Alert } from "@/components/app/ui";
import MarketplaceFilters from "@/components/buyer/MarketplaceFilters";
import BuyerProductCard from "@/components/buyer/BuyerProductCard";
import { BuyerEmptyPanel } from "@/components/buyer/BuyerLayout";
import { BuyerProductGridSkeleton } from "@/components/buyer/BuyerSkeletons";
import Button from "@/components/ui/Button";
import { useT } from "@/lib/i18n";
import { detailRoutes } from "@/lib/navigation";
import {
  emptyMarketplaceFeedFilters,
  marketplaceProductsQuery,
  storeKeyForProduct,
  type MarketplaceFeedFilters,
  type MarketplaceFeedMeta,
  type MarketplaceFeedProduct,
} from "@/lib/marketplaceFeed";

type BizLite = { industry?: string | null };

type Props = {
  industrySeed?: string[];
  className?: string;
};

const PAGE_SIZE = 24;

/** Paginated cross-business product grid with marketplace filters. */
export default function BuyerProductFeed({ industrySeed = [], className = "" }: Props) {
  const t = useT();
  const [filters, setFilters] = useState<MarketplaceFeedFilters>(
    emptyMarketplaceFeedFilters()
  );
  const [products, setProducts] = useState<MarketplaceFeedProduct[]>([]);
  const [meta, setMeta] = useState<MarketplaceFeedMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [categoriesFromApi, setCategoriesFromApi] = useState<string[]>([]);
  const [bizIndustries, setBizIndustries] = useState<string[]>([]);

  const loadPage = useCallback(
    async (cursor: string | null, append: boolean) => {
      if (append) setLoadingMore(true);
      else setLoading(true);

      const path = marketplaceProductsQuery(filters, {
        cursor,
        limit: PAGE_SIZE,
      });

      try {
        const res = await api<{
          data: MarketplaceFeedProduct[];
          meta?: MarketplaceFeedMeta;
        }>(path, {}, null);

        const rows = Array.isArray(res.data) ? res.data : [];
        setProducts((prev) => (append ? [...prev, ...rows] : rows));
        setMeta(res.meta ?? { limit: PAGE_SIZE, next_cursor: null });
        setError(null);

        setCategoriesFromApi((prev) => {
          const set = new Set(append ? prev : []);
          for (const p of rows) {
            if (p.category?.trim()) set.add(p.category.trim());
          }
          return Array.from(set).sort((a, b) => a.localeCompare(b));
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : t("common.loadFailed");
        if (!append) {
          setProducts([]);
          setMeta(null);
        }
        setError(message);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [filters, t]
  );

  useEffect(() => {
    setCategoriesFromApi([]);
  }, [filters.search, filters.industries, filters.categories]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadPage(null, false);
    }, 220);
    return () => clearTimeout(timer);
  }, [loadPage]);

  useEffect(() => {
    void api<{ data: BizLite[] }>("/marketplace/businesses", {}, null)
      .then((res) => {
        const set = new Set<string>();
        for (const b of res.data || []) {
          if (b.industry?.trim()) set.add(b.industry.trim());
        }
        setBizIndustries(Array.from(set).sort((a, b) => a.localeCompare(b)));
      })
      .catch(() => undefined);
  }, []);

  const industries = useMemo(() => {
    const set = new Set<string>([
      ...(industrySeed.filter(Boolean) as string[]),
      ...bizIndustries,
    ]);
    for (const p of products) {
      if (p.industry?.trim()) set.add(p.industry.trim());
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [industrySeed, bizIndustries, products]);

  const nextCursor = meta?.next_cursor ?? null;

  return (
    <div className={`space-y-5 ${className}`}>
      <MarketplaceFilters
        value={filters}
        onChange={setFilters}
        categoryOptions={categoriesFromApi}
        industryOptions={industries}
        resultCount={loading ? undefined : products.length}
        searchPlaceholder={t("marketplace.searchAllProducts")}
      />

      {error ? <Alert tone="error">{error}</Alert> : null}

      {loading ? (
        <BuyerProductGridSkeleton />
      ) : products.length === 0 ? (
        <BuyerEmptyPanel
          icon={<Package className="h-7 w-7" />}
          title={t("marketplace.emptyProductsTitle")}
          body={
            filters.search ||
            filters.categories.length > 0 ||
            filters.industries.length > 0
              ? t("marketplace.noFilterMatches")
              : t("marketplace.emptyProductsBody")
          }
          action={
            filters.search ||
            filters.categories.length > 0 ||
            filters.industries.length > 0 ? (
              <Button
                variant="secondary"
                className="rounded-md"
                onClick={() => setFilters(emptyMarketplaceFeedFilters())}
              >
                {t("marketplace.clearFilters")}
              </Button>
            ) : null
          }
        />
      ) : (
        <>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {products.map((p) => {
              const storeKey = storeKeyForProduct(p);
              return (
                <li key={`${storeKey}:${p.id}`}>
                  <BuyerProductCard
                    product={{
                      ...p,
                      business_slug: p.business_slug || p.marketplace_slug,
                    }}
                    href={detailRoutes.marketProduct(storeKey, p.id)}
                    showStore
                    accent={p.primary_color}
                  />
                </li>
              );
            })}
          </ul>

          {nextCursor ? (
            <div className="flex justify-center pt-2">
              <Button
                variant="secondary"
                className="rounded-md"
                loading={loadingMore}
                onClick={() => void loadPage(nextCursor, true)}
              >
                {t("marketplace.loadMore")}
              </Button>
            </div>
          ) : products.length >= PAGE_SIZE ? (
            <p className="text-center text-xs text-muted">
              {t("marketplace.endOfResults")}
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}
