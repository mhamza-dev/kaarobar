"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ShoppingCart } from "lucide-react";
import { api, isConsumerSession } from "@/lib/api/client";
import { useCart } from "@/lib/cart";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
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

type Product = {
  id: string;
  name: string;
  sku?: string;
  price?: string | null;
  image_url?: string | null;
  description?: string | null;
  category?: string | null;
  category_ref?: { id: string; name: string; slug?: string } | null;
};

type StoreBiz = {
  id: string;
  name: string;
  tagline?: string | null;
  logo_url?: string | null;
  primary_color?: string | null;
  marketplace_description?: string | null;
  industry?: string | null;
};

function productCategory(p: Product): string {
  return p.category_ref?.name || p.category || "Uncategorized";
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
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<ListingFilterState>(emptyListingFilters());
  const signedIn = isConsumerSession();

  useEffect(() => {
    setLoading(true);
    void api<{
      data: {
        business: StoreBiz;
        products: Product[];
      };
    }>(`/marketplace/businesses/${id}/catalog`, {}, null)
      .then((res) => {
        setBusiness(res.data.business);
        setProducts(res.data.products || []);
        setError(null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load store"))
      .finally(() => setLoading(false));
  }, [id]);

  const categoryOptions = useMemo(() => {
    const set = new Set<string>();
    for (const p of products) set.add(productCategory(p));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [products]);

  const filtered = useMemo(
    () =>
      applyListingFilters(products, filters, {
        searchText: (p) =>
          [p.name, p.sku, p.description, productCategory(p)].filter(Boolean).join(" "),
        category: productCategory,
        price: (p) => Number(p.price || 0),
      }),
    [products, filters]
  );

  function handleAdd(p: Product) {
    if (!business) return;
    if (!signedIn) {
      router.push("/login?as=consumer");
      return;
    }
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
      }
    );
    toast.success(`Added ${p.name}`);
  }

  const accent = business?.primary_color || undefined;
  const storeCartCount = business ? storeCount(business.id) : 0;

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
            className="px-5 py-6 sm:px-6"
            style={
              accent
                ? {
                    background: `linear-gradient(135deg, ${accent}14 0%, transparent 55%)`,
                  }
                : undefined
            }
          >
            <div className="flex flex-wrap items-start gap-4">
              <div
                className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-card text-2xl font-bold text-heading shadow-sm"
                style={accent ? { boxShadow: `0 0 0 2px ${accent}55` } : undefined}
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
                    business?.tagline ||
                    t("pages.catalogDesc")
                  }
                  infoKey="page.market.catalog"
                />
                {business?.marketplace_description ? (
                  <p className="mt-2 max-w-2xl text-sm text-body">
                    {business.marketplace_description}
                  </p>
                ) : null}
              </div>
              {storeCartCount > 0 ? (
                <Link href="/app/checkout">
                  <Button className="gap-2">
                    <ShoppingCart className="h-4 w-4" />
                    {t("marketplace.viewCart", { count: storeCartCount })}
                  </Button>
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {error ? <Alert tone="error">{error}</Alert> : null}

      {!loading && products.length > 0 ? (
        <ListingFilters
          value={filters}
          onChange={setFilters}
          categoryOptions={categoryOptions}
          searchPlaceholder="Search products…"
        />
      ) : null}

      {loading ? (
        <p className="text-sm text-body">Loading catalog…</p>
      ) : products.length === 0 ? (
        <EmptyState title="No products listed" body="This store has not published a catalog yet." />
      ) : filtered.length === 0 ? (
        <EmptyState title="No matches" body="Try clearing filters or another search term." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((p) => (
            <SurfaceCard key={p.id} className="flex h-full flex-col overflow-hidden p-0">
              {p.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={p.image_url}
                  alt=""
                  className="h-40 w-full object-cover"
                />
              ) : (
                <div className="flex h-28 items-center justify-center bg-card-muted text-sm text-muted">
                  No image
                </div>
              )}
              <div className="flex flex-1 flex-col p-4">
                <p className="text-[11px] font-bold uppercase tracking-wide text-muted">
                  {productCategory(p)}
                </p>
                <p className="mt-1 font-semibold text-heading">{p.name}</p>
                {p.description ? (
                  <p className="mt-1 line-clamp-2 text-sm text-body">{p.description}</p>
                ) : null}
                <div className="mt-auto flex items-center justify-between gap-3 pt-4">
                  <p className="text-lg font-bold text-heading">Rs {p.price || "0.00"}</p>
                  <Button size="sm" onClick={() => handleAdd(p)}>
                    Add
                  </Button>
                </div>
              </div>
            </SurfaceCard>
          ))}
        </div>
      )}
    </BrandThemeScope>
  );
}
