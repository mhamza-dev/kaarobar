"use client";

import { useEffect, useMemo, useState, type MouseEvent } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Minus, Plus, Search, ShoppingCart, X } from "lucide-react";
import { api, isConsumerSession } from "@/lib/api/client";
import { useCart } from "@/lib/cart";
import Button from "@/components/ui/Button";
import Modal from "@/components/modals/Modal";
import { useToast } from "@/components/ui/Toast";
import {
  Alert,
  EmptyState,
  PageHeader,
  TabBar,
} from "@/components/app/ui";
import {
  applyListingFilters,
  emptyListingFilters,
  type ListingFilterState,
} from "@/components/app/ListingFilters";
import { BrandThemeScope } from "@/components/app/BrandTheme";
import BuyerBookFlow from "@/components/buyer/BuyerBookFlow";
import { BuyerProductGridSkeleton } from "@/components/buyer/BuyerSkeletons";
import { useT } from "@/lib/i18n";

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
  industry?: string | null;
  appointments_enabled?: boolean;
  commerce_mode?: "appointments" | "orders" | string | null;
  online_branch_id?: string | null;
};

type Mode = "shop" | "book";

function isServiceProduct(p: Product): boolean {
  return p.product_kind === "service" || p.product_kind === "combo";
}

function productCategory(p: Product): string {
  return p.category_ref?.name || p.category || "Uncategorized";
}

function formatPrice(price?: string | number | null): string {
  const n = Number(price || 0);
  return Number.isFinite(n) ? n.toFixed(2) : "0.00";
}

export default function MarketplaceStorePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const t = useT();
  const { addItem, storeCount } = useCart();
  const id = params.id;
  const [business, setBusiness] = useState<StoreBiz | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [branchId, setBranchId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<ListingFilterState>(emptyListingFilters());
  const [detail, setDetail] = useState<Product | null>(null);
  const [qty, setQty] = useState(1);
  const [adding, setAdding] = useState(false);
  const [quickAddingId, setQuickAddingId] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("shop");
  const signedIn = isConsumerSession();

  useEffect(() => {
    setLoading(true);
    void api<{
      data: {
        business: StoreBiz;
        products: Product[];
        staff?: StaffMember[];
        branch_id?: string;
      };
    }>(`/marketplace/businesses/${id}/catalog`, {}, null)
      .then((res) => {
        const biz = res.data.business;
        const list = res.data.products || [];
        setBusiness(biz);
        setProducts(list);
        setStaff(res.data.staff || []);
        setBranchId(res.data.branch_id || biz.online_branch_id || null);
        const services = list.filter(isServiceProduct);
        const goods = list.filter((p) => !isServiceProduct(p));
        const canBook = !!biz.appointments_enabled && services.length > 0;
        const canShop = goods.length > 0 || (!canBook && list.length > 0);
        if (canBook && !canShop) setMode("book");
        else if (canShop) setMode("shop");
        setError(null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load store"))
      .finally(() => setLoading(false));
  }, [id]);

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
    setQty(1);
  }, [detail?.id]);

  const categoryOptions = useMemo(() => {
    const set = new Set<string>();
    for (const p of shopProducts) set.add(productCategory(p));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [shopProducts]);

  const filtered = useMemo(
    () =>
      applyListingFilters(shopProducts, filters, {
        searchText: (p) =>
          [p.name, p.sku, p.description, productCategory(p)].filter(Boolean).join(" "),
        category: productCategory,
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

  function handleAdd(p: Product, quantity = 1) {
    if (!business) return;
    if (!requireSignIn()) return;
    setAdding(true);
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
          category: productCategory(p),
        },
        quantity
      );
      toast.success(t("marketplace.addedToCart", { name: p.name }));
      setDetail(null);
    } finally {
      setAdding(false);
    }
  }

  function handleQuickAdd(e: MouseEvent, p: Product) {
    e.stopPropagation();
    e.preventDefault();
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
          category: productCategory(p),
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
  const detailTotal = detail ? Number(detail.price || 0) * qty : 0;

  return (
    <BrandThemeScope primaryColor={accent} className="space-y-6">
      <div>
        <Link href="/app" className="text-sm font-medium text-brand hover:underline">
          {t("marketplace.allStores")}
        </Link>
        <div
          className="mt-3 overflow-hidden rounded-md border border-border bg-card"
          style={accent ? { borderTopWidth: 4, borderTopColor: accent } : undefined}
        >
          <div
            className="relative px-5 py-6 sm:px-8 sm:py-8"
            style={
              accent
                ? {
                  background: `radial-gradient(ellipse 70% 80% at 0% 0%, ${accent}18 0%, transparent 55%), radial-gradient(ellipse 40% 50% at 100% 0%, ${accent}0c 0%, transparent 45%)`,
                }
                : undefined
            }
          >
            <div className="flex flex-wrap items-start gap-4">
              <div
                className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-card text-2xl font-bold text-heading shadow-md"
                style={accent ? { boxShadow: `0 8px 28px ${accent}33` } : undefined}
              >
                {business?.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={business.logo_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  (business?.name || "?").slice(0, 1).toUpperCase()
                )}
              </div>
              <div className="min-w-0 flex-1">
                <PageHeader
                  eyebrow={business?.industry || t("marketplace.eyebrow")}
                  title={business?.name || t("pages.catalogTitle")}
                  description={
                    canBook && !canShop
                      ? t("pages.catalogBookDesc")
                      : business?.tagline || t("pages.catalogDesc")
                  }
                  infoKey={
                    mode === "book" ? "page.market.book" : "page.market.catalog"
                  }
                />
                {business?.marketplace_description ? (
                  <p className="mt-2 max-w-2xl text-sm leading-relaxed text-body">
                    {business.marketplace_description}
                  </p>
                ) : null}
              </div>
              {mode === "shop" && storeCartCount > 0 ? (
                <Link href="/app/checkout">
                  <Button
                    className="gap-2 rounded-md px-5 py-2.5"
                    startIcon={<ShoppingCart className="h-4 w-4" />}
                  >
                    {t("marketplace.viewCart", { count: storeCartCount })}
                  </Button>
                </Link>
              ) : null}
            </div>
          </div>
        </div>
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
              onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
              placeholder={t("marketplace.searchProducts")}
              className="w-full rounded-md border border-border bg-card py-3 pe-4 ps-10 text-sm text-heading shadow-sm outline-none transition placeholder:text-muted focus:border-brand/40 focus:ring-2 focus:ring-brand/15"
            />
          </div>
          {categoryOptions.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setFilters((f) => ({ ...f, categories: [] }))}
                className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${filters.categories.length === 0
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
                    className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${on
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
        <EmptyState
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
        <EmptyState
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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((p) => (
            <article
              key={p.id}
              className="group relative flex h-full flex-col overflow-hidden rounded-md border border-border bg-card text-left transition duration-200 hover:-translate-y-0.5 hover:border-brand/25 hover:shadow-lg"
            >
              <div className="relative aspect-[4/3] overflow-hidden bg-bg-secondary">
                <button
                  type="button"
                  onClick={() => setDetail(p)}
                  className="absolute inset-0"
                  aria-label={p.name}
                >
                  {p.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.image_url}
                      alt=""
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
                    />
                  ) : (
                    <div
                      className="flex h-full w-full items-center justify-center text-sm font-medium text-muted"
                      style={
                        accent
                          ? {
                            background: `linear-gradient(145deg, ${accent}14 0%, transparent 70%)`,
                          }
                          : undefined
                      }
                    >
                      {t("marketplace.noImage")}
                    </div>
                  )}
                </button>
                <button
                  type="button"
                  onClick={(e) => handleQuickAdd(e, p)}
                  className="absolute bottom-3 end-3 z-10 inline-flex h-11 min-w-11 items-center justify-center gap-1 rounded-full bg-brand px-3.5 text-sm font-bold text-brand-foreground shadow-md transition hover:brightness-110 active:scale-95"
                  aria-label={t("marketplace.quickAdd")}
                >
                  <Plus className="h-4 w-4" strokeWidth={2.5} />
                  <span className="hidden sm:inline">{t("marketplace.quickAdd")}</span>
                </button>
                {quickAddingId === p.id ? (
                  <span className="pointer-events-none absolute inset-0 z-20 bg-card/40" aria-hidden />
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => setDetail(p)}
                className="flex flex-1 flex-col gap-1.5 p-3.5 text-left sm:p-4"
              >
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted">
                  {productCategory(p)}
                </p>
                <p className="line-clamp-2 text-[15px] font-semibold leading-snug text-heading">
                  {p.name}
                </p>
                <p className="mt-auto pt-2 text-lg font-bold tracking-tight text-heading">
                  Rs {formatPrice(p.price)}
                </p>
              </button>
            </article>
          ))}
        </div>
      )}

      <Modal
        isOpen={!!detail}
        onClose={() => setDetail(null)}
        title={detail?.name}
        description={detail ? productCategory(detail) : undefined}
        size="lg"
        footer={
          detail ? (
            <div className="flex w-full flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <span className="text-xs font-bold uppercase tracking-wide text-muted">
                  {t("marketplace.quantity")}
                </span>
                <div className="inline-flex items-center rounded-md border border-border bg-card">
                  <button
                    type="button"
                    aria-label="Decrease quantity"
                    disabled={qty <= 1}
                    onClick={() => setQty((q) => Math.max(1, q - 1))}
                    className="flex h-11 w-11 items-center justify-center rounded-s-xl text-heading transition hover:bg-bg-secondary disabled:opacity-40"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="min-w-[2.5rem] text-center text-base font-bold text-heading">
                    {qty}
                  </span>
                  <button
                    type="button"
                    aria-label="Increase quantity"
                    onClick={() => setQty((q) => Math.min(99, q + 1))}
                    className="flex h-11 w-11 items-center justify-center rounded-e-xl text-heading transition hover:bg-bg-secondary"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                <div className="hidden sm:block">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-muted">
                    {t("marketplace.lineTotal")}
                  </p>
                  <p className="text-lg font-bold text-heading">Rs {formatPrice(detailTotal)}</p>
                </div>
              </div>
              <Button
                loading={adding}
                onClick={() => handleAdd(detail, qty)}
                className="h-12 w-full rounded-md px-6 text-base sm:w-auto"
              >
                {qty > 1
                  ? t("marketplace.addQtyToCart", { count: qty })
                  : t("marketplace.addToCart")}
              </Button>
            </div>
          ) : null
        }
      >
        {detail ? (
          <div className="space-y-5">
            <div className="overflow-hidden rounded-md bg-bg-secondary">
              {detail.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={detail.image_url}
                  alt=""
                  className="max-h-80 w-full object-cover"
                />
              ) : (
                <div className="flex h-48 items-center justify-center text-muted">
                  {t("marketplace.noImage")}
                </div>
              )}
            </div>
            <p className="text-2xl font-bold text-brand">Rs {formatPrice(detail.price)}</p>
            {detail.description ? (
              <p className="text-sm leading-relaxed text-body">{detail.description}</p>
            ) : (
              <p className="text-sm text-muted">{t("marketplace.noDescription")}</p>
            )}
            {detail.sku ? (
              <p className="text-xs text-muted">SKU · {detail.sku}</p>
            ) : null}
            <div className="sm:hidden">
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted">
                {t("marketplace.lineTotal")}
              </p>
              <p className="text-xl font-bold text-heading">Rs {formatPrice(detailTotal)}</p>
            </div>
          </div>
        ) : null}
      </Modal>
        </>
      ) : null}

      {!loading && !canShop && !canBook ? (
        <EmptyState
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
