"use client";

import { useEffect, useMemo, useState } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
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
import { marketplaceKeys } from "@/lib/queryClient";
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

function filtersKey(filters: MarketplaceFeedFilters): Record<string, unknown> {
  return {
    search: filters.search.trim(),
    categories: [...filters.categories].sort(),
    industries: [...filters.industries].sort(),
    priceMin: filters.priceMin.trim(),
    priceMax: filters.priceMax.trim(),
  };
}

/** Paginated cross-business product grid with marketplace filters. */
export default function BuyerProductFeed({ industrySeed = [], className = "" }: Props) {
  const t = useT();
  const [filters, setFilters] = useState<MarketplaceFeedFilters>(
    emptyMarketplaceFeedFilters()
  );
  const [debouncedFilters, setDebouncedFilters] = useState(filters);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedFilters(filters), 220);
    return () => clearTimeout(timer);
  }, [filters]);

  const productsQuery = useInfiniteQuery({
    queryKey: marketplaceKeys.products(filtersKey(debouncedFilters)),
    queryFn: async ({ pageParam }) => {
      const path = marketplaceProductsQuery(debouncedFilters, {
        cursor: pageParam,
        limit: PAGE_SIZE,
      });
      const res = await api<{
        data: MarketplaceFeedProduct[];
        meta?: MarketplaceFeedMeta;
      }>(path, {}, null);
      return {
        data: Array.isArray(res.data) ? res.data : [],
        meta: res.meta ?? { limit: PAGE_SIZE, next_cursor: null },
      };
    },
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.meta.next_cursor ?? undefined,
  });

  const businessesQuery = useQuery({
    queryKey: marketplaceKeys.businesses({}),
    queryFn: async () => {
      const res = await api<{ data: BizLite[] }>("/marketplace/businesses", {}, null);
      return res.data || [];
    },
  });

  const products = useMemo(
    () => productsQuery.data?.pages.flatMap((p) => p.data) ?? [],
    [productsQuery.data]
  );

  const categoriesFromApi = useMemo(() => {
    const set = new Set<string>();
    for (const p of products) {
      if (p.category?.trim()) set.add(p.category.trim());
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [products]);

  const bizIndustries = useMemo(() => {
    const set = new Set<string>();
    for (const b of businessesQuery.data || []) {
      if (b.industry?.trim()) set.add(b.industry.trim());
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [businessesQuery.data]);

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

  const loading = productsQuery.isLoading;
  const loadingMore = productsQuery.isFetchingNextPage;
  const errorMessage =
    productsQuery.error instanceof Error
      ? productsQuery.error.message
      : productsQuery.error
        ? t("common.loadFailed")
        : null;
  const hasNextPage = productsQuery.hasNextPage;

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

      {errorMessage ? <Alert tone="error">{errorMessage}</Alert> : null}

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

          {hasNextPage ? (
            <div className="flex justify-center pt-2">
              <Button
                variant="secondary"
                className="rounded-md"
                loading={loadingMore}
                onClick={() => void productsQuery.fetchNextPage()}
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
