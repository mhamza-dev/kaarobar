"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Minus, Plus, ShoppingCart, Store } from "lucide-react";
import { api, isConsumerSession } from "@/lib/api/client";
import { useCart } from "@/lib/cart";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { Alert, StatusBadge } from "@/components/app/ui";
import { BrandThemeScope } from "@/components/app/BrandTheme";
import {
  BuyerBackLink,
  BuyerCard,
  BuyerEmptyPanel,
  formatMarketplacePrice,
  marketplaceProductCategory,
} from "@/components/buyer/BuyerLayout";
import { BuyerOrderDetailSkeleton } from "@/components/buyer/BuyerSkeletons";
import { useT } from "@/lib/i18n";
import InfoButton from "@/components/ui/InfoButton";

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

type StoreBiz = {
  id: string;
  name: string;
  tagline?: string | null;
  logo_url?: string | null;
  primary_color?: string | null;
  marketplace_slug?: string | null;
  industry?: string | null;
};

/** Product detail under a marketplace store. */
export default function BuyerProductDetail() {
  const params = useParams<{ id: string; productId: string }>();
  const router = useRouter();
  const toast = useToast();
  const t = useT();
  const { addItem, storeCount } = useCart();
  const storeKey = params.id;
  const productId = params.productId;

  const [business, setBusiness] = useState<StoreBiz | null>(null);
  const [product, setProduct] = useState<Product | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [qty, setQty] = useState(1);
  const [adding, setAdding] = useState(false);
  const signedIn = isConsumerSession();

  useEffect(() => {
    setLoading(true);
    void api<{
      data: { business: StoreBiz; products: Product[] };
    }>(`/marketplace/businesses/${storeKey}/catalog`, {}, null)
      .then((res) => {
        setBusiness(res.data.business);
        const found = (res.data.products || []).find((p) => p.id === productId) || null;
        setProduct(found);
        setError(found ? null : t("marketplace.productNotFound"));
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : t("common.loadFailed"))
      )
      .finally(() => setLoading(false));
  }, [storeKey, productId, t]);

  function requireSignIn(): boolean {
    if (!signedIn) {
      router.push("/login?as=consumer");
      return false;
    }
    return true;
  }

  function handleAdd() {
    if (!business || !product) return;
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
          id: product.id,
          name: product.name,
          price: Number(product.price || 0),
          imageUrl: product.image_url,
          category: marketplaceProductCategory(product),
        },
        qty
      );
      toast.success(t("marketplace.addedToCart", { name: product.name }));
    } finally {
      setAdding(false);
    }
  }

  if (loading) return <BuyerOrderDetailSkeleton />;

  const accent = business?.primary_color || undefined;
  const storeHref = `/app/market/${business?.marketplace_slug || business?.id || storeKey}`;
  const cartCount = business ? storeCount(business.id) : 0;
  const lineTotal = product ? Number(product.price || 0) * qty : 0;

  if (error && !product) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <BuyerBackLink href="/app">{t("marketplace.backToDiscover")}</BuyerBackLink>
        {error.includes("not") || error === t("marketplace.productNotFound") ? (
          <BuyerEmptyPanel
            icon={<Store className="h-7 w-7" />}
            title={t("marketplace.productNotFound")}
            body={t("marketplace.productNotFoundBody")}
            action={
              <Link href="/app">
                <Button variant="secondary" className="rounded-md">
                  {t("marketplace.browseProducts")}
                </Button>
              </Link>
            }
          />
        ) : (
          <Alert tone="error">{error}</Alert>
        )}
      </div>
    );
  }

  if (!product || !business) return null;

  const isService =
    product.product_kind === "service" || product.product_kind === "combo";

  return (
    <BrandThemeScope primaryColor={accent} className="mx-auto max-w-4xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <BuyerBackLink href="/app">{t("marketplace.backToDiscover")}</BuyerBackLink>
        {cartCount > 0 ? (
          <Link href="/app/checkout">
            <Button
              variant="secondary"
              className="gap-2 rounded-md"
              startIcon={<ShoppingCart className="h-4 w-4" />}
            >
              {t("marketplace.viewCart", { count: cartCount })}
            </Button>
          </Link>
        ) : null}
      </div>

      <BuyerCard accent={accent} className="p-0">
        <div className="grid gap-0 md:grid-cols-2">
          <div className="aspect-square bg-bg-secondary md:aspect-auto md:min-h-[22rem]">
            {product.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={product.image_url}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <div
                className="flex h-full min-h-[16rem] items-center justify-center text-muted"
                style={
                  accent
                    ? { background: `linear-gradient(145deg, ${accent}18 0%, transparent 70%)` }
                    : undefined
                }
              >
                {t("marketplace.noImage")}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-4 p-5 sm:p-7">
            <div>
              <div className="flex items-center gap-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted">
                  {marketplaceProductCategory(product)}
                </p>
                <InfoButton topicId="page.market.productDetail" />
              </div>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-heading sm:text-3xl">
                {product.name}
              </h1>
            </div>

            <p className="text-3xl font-bold text-heading">
              Rs {formatMarketplacePrice(product.price)}
            </p>

            {isService ? (
              <StatusBadge tone="info">
                {product.duration_minutes
                  ? t("appointments.minutes", { count: product.duration_minutes })
                  : t("appointments.service")}
              </StatusBadge>
            ) : null}

            {product.description ? (
              <p className="text-sm leading-relaxed text-body">{product.description}</p>
            ) : (
              <p className="text-sm text-muted">{t("marketplace.noDescription")}</p>
            )}

            {product.sku ? (
              <p className="text-xs text-muted">SKU · {product.sku}</p>
            ) : null}

            <div className="mt-auto flex flex-col gap-4 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
              {!isService ? (
                <>
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
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wide text-muted">
                        {t("marketplace.lineTotal")}
                      </p>
                      <p className="text-lg font-bold text-heading">
                        Rs {formatMarketplacePrice(lineTotal)}
                      </p>
                    </div>
                  </div>
                  <Button
                    loading={adding}
                    onClick={handleAdd}
                    className="h-12 w-full rounded-md px-6 text-base sm:w-auto"
                  >
                    {qty > 1
                      ? t("marketplace.addQtyToCart", { count: qty })
                      : t("marketplace.addToCart")}
                  </Button>
                </>
              ) : (
                <Link href={`${storeHref}?mode=book`} className="w-full sm:w-auto">
                  <Button className="h-12 w-full rounded-md px-6 text-base">
                    {t("marketplace.bookThisService")}
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>
      </BuyerCard>

      <Link href={storeHref} className="block">
        <BuyerCard hover accent={accent} className="p-4 sm:p-5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted">
            {t("marketplace.soldBy")}
          </p>
          <div className="mt-3 flex items-center gap-3">
            <div
              className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-card text-lg font-bold text-heading"
              style={accent ? { backgroundColor: `${accent}18` } : undefined}
            >
              {business.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={business.logo_url} alt="" className="h-full w-full object-cover" />
              ) : (
                (business.name || "?").slice(0, 1).toUpperCase()
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-lg font-bold text-heading">{business.name}</p>
              {business.tagline ? (
                <p className="truncate text-sm text-body">{business.tagline}</p>
              ) : business.industry ? (
                <p className="text-sm text-muted">{business.industry}</p>
              ) : null}
              <p className="mt-1 text-sm font-semibold text-brand">
                {t("marketplace.shopCardHint")} →
              </p>
            </div>
            <Store className="h-5 w-5 shrink-0 text-muted" />
          </div>
        </BuyerCard>
      </Link>
    </BrandThemeScope>
  );
}
