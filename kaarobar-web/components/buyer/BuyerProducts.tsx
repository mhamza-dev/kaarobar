"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Package } from "lucide-react";
import { api } from "@/lib/api/client";
import { Alert } from "@/components/app/ui";
import ListingFilters, {
  applyListingFilters,
  emptyListingFilters,
  type ListingFilterState,
} from "@/components/app/ListingFilters";
import {
  BuyerEmptyPanel,
  BuyerHero,
} from "@/components/buyer/BuyerLayout";
import BuyerProductCard, {
  type MarketplaceProductCardItem,
} from "@/components/buyer/BuyerProductCard";
import { BuyerProductGridSkeleton } from "@/components/buyer/BuyerSkeletons";
import Button from "@/components/ui/Button";
import { useT } from "@/lib/i18n";
import { detailRoutes } from "@/lib/navigation";

type FeedProduct = MarketplaceProductCardItem & {
  sku?: string | null;
  description?: string | null;
  industry?: string | null;
  marketplace_slug?: string | null;
  product_kind?: string | null;
};

/** Cross-business product feed — `/app/products`. */
export default function BuyerProducts() {
  const t = useT();
  const [filters, setFilters] = useState<ListingFilterState>(emptyListingFilters());
  const [products, setProducts] = useState<FeedProduct[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [apiReady, setApiReady] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(true);
      const q = filters.search.trim();
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      const qs = params.toString();
      void api<{ data: FeedProduct[] }>(
        `/marketplace/products${qs ? `?${qs}` : ""}`,
        {},
        null
      )
        .then((res) => {
          setProducts(Array.isArray(res.data) ? res.data : []);
          setError(null);
          setApiReady(true);
        })
        .catch((err) => {
          const message = err instanceof Error ? err.message : t("common.loadFailed");
          // Endpoint may not be shipped yet — treat as empty feed, not a hard crash.
          const notReady =
            /not_found|404|undefined|route/i.test(message) ||
            message === "Failed to fetch";
          setApiReady(!notReady);
          setProducts([]);
          setError(notReady ? null : message);
        })
        .finally(() => setLoading(false));
    }, 200);
    return () => clearTimeout(timer);
  }, [filters.search, t]);

  const industryOptions = useMemo(() => {
    const set = new Set<string>();
    for (const p of products) {
      if (p.industry?.trim()) set.add(p.industry.trim());
      const cat = p.category_ref?.name || p.category;
      if (cat?.trim()) set.add(cat.trim());
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [products]);

  const filtered = useMemo(
    () =>
      applyListingFilters(products, { ...filters, search: "" }, {
        searchText: () => "",
        category: (p) => p.industry || p.category_ref?.name || p.category || "",
        price: (p) => Number(p.price || 0),
      }),
    [products, filters]
  );

  return (
    <div className="space-y-8">
      <BuyerHero
        eyebrow={t("marketplace.eyebrow")}
        title={t("pages.productsTitle")}
        description={t("pages.productsDesc")}
        infoKey="page.market.products"
      >
        <p className="mt-3 max-w-xl text-sm text-body">{t("marketplace.productsHero")}</p>
      </BuyerHero>

      <ListingFilters
        value={filters}
        onChange={setFilters}
        categoryOptions={industryOptions}
        categoryLabel={t("marketplace.filterCategory")}
        showPrice
        searchPlaceholder={t("marketplace.searchAllProducts")}
      />

      {error ? <Alert tone="error">{error}</Alert> : null}

      {loading ? (
        <BuyerProductGridSkeleton />
      ) : filtered.length === 0 ? (
        <BuyerEmptyPanel
          icon={<Package className="h-7 w-7" />}
          title={
            products.length === 0
              ? t("marketplace.emptyProductsTitle")
              : t("common.noResults")
          }
          body={
            products.length === 0
              ? apiReady
                ? t("marketplace.emptyProductsBody")
                : t("marketplace.productsApiUnavailable")
              : t("marketplace.noFilterMatches")
          }
          action={
            <Link href="/app">
              <Button variant="secondary" className="rounded-md">
                {t("marketplace.browseStores")}
              </Button>
            </Link>
          }
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((p) => {
            const storeKey = p.marketplace_slug || p.business_id || "";
            return (
              <li key={`${storeKey}:${p.id}`}>
                <BuyerProductCard
                  product={{
                    ...p,
                    business_slug: p.marketplace_slug,
                  }}
                  href={detailRoutes.marketProduct(storeKey, p.id)}
                  showStore
                  accent={p.primary_color}
                />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
