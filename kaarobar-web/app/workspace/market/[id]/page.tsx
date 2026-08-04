"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Search, ShoppingCart, X } from "lucide-react";
import { api, isConsumerSession } from "@/lib/api/client";
import { useCart } from "@/lib/cart";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import {
  Alert,
  TabBar,
} from "@/components/app/ui";
import {
  applyListingFilters,
  emptyListingFilters,
  type ListingFilterState,
} from "@/components/app/ListingFilters";
import { BrandThemeScope } from "@/components/app/BrandTheme";
import BuyerBookFlow from "@/components/buyer/BuyerBookFlow";
import BuyerProductCard from "@/components/buyer/BuyerProductCard";
import {
  BuyerBackLink,
  BuyerEmptyPanel,
  BuyerHero,
  marketplaceProductCategory,
} from "@/components/buyer/BuyerLayout";
import { BuyerProductGridSkeleton } from "@/components/buyer/BuyerSkeletons";
import { useT } from "@/lib/i18n";
import { detailRoutes } from "@/lib/navigation";
import { marketplaceKeys } from "@/lib/queryClient";

type Product = {
  id: string;
  name: string;
  sku?: string;
  price?: string | null;
  image_url?: string | null;
  description?: string | null;
  category?: string | null;
  category_ref?: { id: string; name: string; slug?: string } | null;
  product_kind?: string | null;
  duration_minutes?: number | null;
};

type StaffMember = { id: string; name: string };

type StoreBiz = {
  id: string;
  name: string;
  tagline?: string | null;
  logo_url?: string | null;
  primary_color?: string | null;
  marketplace_description?: string | null;
  marketplace_slug?: string | null;
  industry?: string | null;
  appointments_enabled?: boolean;
  commerce_mode?: "appointments" | "orders" | string | null;
  online_branch_id?: string | null;
};

type Mode = "shop" | "book";

function isServiceProduct(p: Product): boolean {
  return p.product_kind === "service" || p.product_kind === "combo";
}

export default function MarketplaceStorePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const t = useT();
  const { addItem, storeCount } = useCart();
  const id = params.id;
  const [filters, setFilters] = useState<ListingFilterState>(emptyListingFilters());
  const [quickAddingId, setQuickAddingId] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("shop");
  const [modeInitialized, setModeInitialized] = useState(false);
  const signedIn = isConsumerSession();

  const catalogQuery = useQuery({
    queryKey: marketplaceKeys.catalog(id),
    queryFn: async () => {
      const res = await api<{
        data: {
          business: StoreBiz;
          products: Product[];
          staff?: StaffMember[];
          branch_id?: string;
        };
      }>(`/marketplace/businesses/${id}/catalog`, {}, null);
      const biz = res.data.business;
      return {
        business: biz,
        products: res.data.products || [],
        staff: res.data.staff || [],
        branchId: res.data.branch_id || biz.online_branch_id || null,
      };
    },
    enabled: !!id,
  });

  const business = catalogQuery.data?.business ?? null;
  const products = catalogQuery.data?.products ?? [];
  const staff = catalogQuery.data?.staff ?? [];
  const branchId = catalogQuery.data?.branchId ?? null;
  const loading = catalogQuery.isLoading;
  const error =
    catalogQuery.error instanceof Error
      ? catalogQuery.error.message
      : catalogQuery.error
        ? "Failed to load store"
        : null;

  const services = useMemo(() => products.filter(isServiceProduct), [products]);
  const goods = useMemo(() => products.filter((p) => !isServiceProduct(p)), [products]);
  const canBook = !!business?.appointments_enabled && services.length > 0;
  const canShop = goods.length > 0 || (!canBook && products.length > 0);
  const showModeTabs = canBook && goods.length > 0;
  const shopProducts = useMemo(() => {
    if (canBook && goods.length > 0) return goods;
    return products;
  }, [canBook, goods, products]);

  useEffect(() => {
    setModeInitialized(false);
  }, [id]);

  useEffect(() => {
    if (!catalogQuery.isSuccess || modeInitialized) return;
    if (canBook && !canShop) setMode("book");
    else if (canShop) setMode("shop");
    setModeInitialized(true);
  }, [catalogQuery.isSuccess, canBook, canShop, modeInitialized]);

  const categoryOptions = useMemo(() => {
    const set = new Set<string>();
    for (const p of shopProducts) set.add(marketplaceProductCategory(p));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [shopProducts]);

  const filtered = useMemo(
    () =>
      applyListingFilters(shopProducts, filters, {
        searchText: (p) =>
          [p.name, p.sku, p.description, marketplaceProductCategory(p)]
            .filter(Boolean)
            .join(" "),
        category: marketplaceProductCategory,
        price: (p) => Number(p.price || 0),
      }),
    [shopProducts, filters]
  );

  const filtersActive =
    filters.search.trim() !== "" || filters.categories.length > 0;

  function requireSignIn(): boolean {
    if (!signedIn) {
      router.push("/login?as=consumer");
      return false;
    }
    return true;
  }

  function handleQuickAdd(p: Product) {
    if (!business) return;
    if (!requireSignIn()) return;
    setQuickAddingId(p.id);
    try {
      addItem(
        {
          id: business.id,
          name: business.name,
          branding: {
            logoUrl: business.logo_url,
            primaryColor: business.primary_color,
            tagline: business.tagline,
          },
        },
        {
          id: p.id,
          name: p.name,
          price: Number(p.price || 0),
          imageUrl: p.image_url,
          category: marketplaceProductCategory(p),
        },
        1
      );
      toast.success(t("marketplace.addedToCart", { name: p.name }));
    } finally {
      setQuickAddingId(null);
    }
  }

  function toggleCategory(cat: string) {
    setFilters((prev) => ({
      ...prev,
      categories: prev.categories.includes(cat) ? [] : [cat],
    }));
  }

  const accent = business?.primary_color || undefined;
  const storeCartCount = business ? storeCount(business.id) : 0;
  const storeKey = business?.marketplace_slug || business?.id || id;

  return (
    <BrandThemeScope primaryColor={accent} className="space-y-6">
      <div className="space-y-3">
        <BuyerBackLink href="/app">{t("marketplace.backToDiscover")}</BuyerBackLink>
        <BuyerHero
          eyebrow={business?.industry || t("marketplace.eyebrow")}
          title={business?.name || t("pages.catalogTitle")}
          description={
            canBook && !canShop
              ? t("pages.catalogBookDesc")
              : business?.tagline || t("pages.catalogDesc")
          }
          infoKey={mode === "book" ? "page.market.book" : "page.market.catalog"}
          accent={accent}
        >
          {business?.marketplace_description ? (
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-body">
              {business.marketplace_description}
            </p>
          ) : null}
          {mode === "shop" && storeCartCount > 0 ? (
            <div className="mt-4">
              <Link href="/app/checkout">
                <Button
                  className="gap-2 rounded-md px-5 py-2.5"
                  startIcon={<ShoppingCart className="h-4 w-4" />}
                >
                  {t("marketplace.viewCart", { count: storeCartCount })}
                </Button>
              </Link>
            </div>
          ) : null}
        </BuyerHero>
      </div>

      {error ? <Alert tone="error">{error}</Alert> : null}

      {!loading && showModeTabs ? (
        <TabBar
          aria-label={t("appointments.modeTabs")}
          tabs={[
            {
              id: "shop" as const,
              label: t("appointments.modeShop"),
              infoKey: "tab.market.shop",
            },
            {
              id: "book" as const,
              label: t("appointments.modeBook"),
              infoKey: "tab.market.book",
            },
          ]}
          value={mode}
          onChange={setMode}
        />
      ) : null}

      {loading ? (
        <BuyerProductGridSkeleton />
      ) : mode === "book" && canBook ? (
        <BuyerBookFlow
          businessId={business!.id}
          branchId={branchId}
          services={services}
          staff={staff}
          accent={accent}
        />
      ) : mode === "shop" && canShop ? (
        <>
          {shopProducts.length > 0 ? (
            <div className="space-y-3">
              <div className="relative">
                <Search className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                <input
                  type="search"
                  value={filters.search}
                  onChange={(e) =>
                    setFilters((f) => ({ ...f, search: e.target.value }))
                  }
                  placeholder={t("marketplace.searchProducts")}
                  className="w-full rounded-md border border-border bg-card py-3 pe-4 ps-10 text-sm text-heading shadow-sm outline-none transition placeholder:text-muted focus:border-brand/20"
                />
              </div>
              {categoryOptions.length > 0 ? (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setFilters((f) => ({ ...f, categories: [] }))}
                    className={`rounded-md px-3.5 py-1.5 text-xs font-semibold transition ${
                      filters.categories.length === 0
                        ? "bg-brand text-brand-foreground shadow-sm"
                        : "border border-border bg-card text-heading hover:border-brand/30"
                    }`}
                  >
                    {t("marketplace.allCategories")}
                  </button>
                  {categoryOptions.map((cat) => {
                    const on = filters.categories.includes(cat);
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => toggleCategory(cat)}
                        className={`rounded-md px-3.5 py-1.5 text-xs font-semibold transition ${
                          on
                            ? "bg-brand text-brand-foreground shadow-sm"
                            : "border border-border bg-card text-heading hover:border-brand/30"
                        }`}
                      >
                        {cat}
                      </button>
                    );
                  })}
                  {filtersActive ? (
                    <button
                      type="button"
                      onClick={() => setFilters(emptyListingFilters())}
                      className="ms-auto inline-flex items-center gap-1 text-xs font-semibold text-muted hover:text-heading"
                    >
                      <X className="h-3.5 w-3.5" />
                      {t("marketplace.clearFilters")}
                    </button>
                  ) : (
                    <span className="ms-auto text-xs font-medium text-muted">
                      {t("marketplace.productsCount", { count: filtered.length })}
                    </span>
                  )}
                </div>
              ) : null}
            </div>
          ) : null}

          {shopProducts.length === 0 ? (
            <BuyerEmptyPanel
              title={t("marketplace.emptyCatalogTitle")}
              body={t("marketplace.emptyCatalogBody")}
              action={
                <Link href="/app">
                  <Button variant="secondary" className="rounded-md">
                    {t("marketplace.browseStores")}
                  </Button>
                </Link>
              }
            />
          ) : filtered.length === 0 ? (
            <BuyerEmptyPanel
              title={t("common.noResults")}
              body={t("marketplace.noFilterMatches")}
              action={
                <Button
                  variant="secondary"
                  className="rounded-md"
                  onClick={() => setFilters(emptyListingFilters())}
                >
                  {t("marketplace.clearFilters")}
                </Button>
              }
            />
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filtered.map((p) => (
                <li key={p.id}>
                  <BuyerProductCard
                    product={p}
                    href={detailRoutes.marketProduct(storeKey, p.id)}
                    accent={accent}
                    onQuickAdd={() => handleQuickAdd(p)}
                    quickAdding={quickAddingId === p.id}
                  />
                </li>
              ))}
            </ul>
          )}
        </>
      ) : null}

      {!loading && !canShop && !canBook ? (
        <BuyerEmptyPanel
          title={t("marketplace.emptyCatalogTitle")}
          body={t("marketplace.emptyCatalogBody")}
          action={
            <Link href="/app">
              <Button variant="secondary" className="rounded-md">
                {t("marketplace.browseStores")}
              </Button>
            </Link>
          }
        />
      ) : null}
    </BrandThemeScope>
  );
}
