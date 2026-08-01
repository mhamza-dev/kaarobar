"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";
import { useCart } from "@/lib/cart";
import Button from "@/components/ui/Button";
import { BrandThemeScope } from "@/components/app/BrandTheme";
import {
  BuyerCard,
  BuyerEmptyPanel,
  BuyerHero,
} from "@/components/buyer/BuyerLayout";
import { useT } from "@/lib/i18n";

function money(n: number) {
  return n.toFixed(2);
}

export default function CheckoutReviewPage() {
  const router = useRouter();
  const t = useT();
  const { stores, itemCount, subtotal, setQty, removeItem, clearStore } = useCart();

  useEffect(() => {
    if (stores.length === 0) {
      router.replace("/app");
    }
  }, [stores.length, router]);

  if (stores.length === 0) {
    return (
      <BuyerEmptyPanel
        icon={<ShoppingCart className="h-7 w-7" />}
        title={t("marketplace.emptyCartTitle")}
        body={t("marketplace.emptyCartBody")}
        action={
          <Link href="/app">
            <Button variant="secondary" className="rounded-md">
              {t("marketplace.browseStores")}
            </Button>
          </Link>
        }
      />
    );
  }

  const storeLabel =
    stores.length === 1
      ? stores[0].businessName
      : t("marketplace.storesCount", { count: stores.length });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <BuyerHero
        eyebrow={t("marketplace.checkoutEyebrow")}
        title={t("pages.checkoutReviewTitle")}
        description={`${storeLabel} · ${itemCount} · ${t("pages.checkoutReviewDesc")}`}
        infoKey="page.checkout.review"
      />

      {stores.map((store) => {
        const accent = store.branding?.primaryColor || undefined;
        const storeTotal = store.lines.reduce((s, l) => s + l.quantity * l.price, 0);
        return (
          <BrandThemeScope key={store.businessId} primaryColor={accent}>
            <BuyerCard accent={accent} className="p-0">
              <div className="flex items-center gap-3 border-b border-border bg-bg-secondary/50 px-4 py-3">
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-card text-sm font-bold text-heading"
                  style={accent ? { backgroundColor: `${accent}18` } : undefined}
                >
                  {store.branding?.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={store.branding.logoUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    store.businessName.slice(0, 1).toUpperCase()
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-heading">{store.businessName}</p>
                  {store.branding?.tagline ? (
                    <p className="truncate text-xs text-muted">{store.branding.tagline}</p>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Link href={`/app/market/${store.businessId}`}>
                    <Button variant="ghost" size="sm">
                      {t("marketplace.shopNow")}
                    </Button>
                  </Link>
                  <button
                    type="button"
                    className="text-xs font-medium text-muted hover:text-danger"
                    onClick={() => clearStore(store.businessId)}
                  >
                    {t("marketplace.clearCart")}
                  </button>
                </div>
              </div>

              <ul className="divide-y divide-border">
                {store.lines.map((line) => (
                  <li key={line.productId} className="flex gap-3 p-4">
                    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-md border border-border bg-card-muted">
                      {line.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={line.imageUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-[10px] text-muted">
                          {t("marketplace.noImage")}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-heading">{line.name}</p>
                      {line.category ? (
                        <p className="text-xs text-muted">{line.category}</p>
                      ) : null}
                      <p className="mt-1 text-sm font-bold text-heading">
                        Rs {money(line.price)} each
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        <button
                          type="button"
                          className="flex h-8 w-8 items-center justify-center rounded-md border border-border text-brand hover:bg-brand-soft"
                          onClick={() =>
                            setQty(store.businessId, line.productId, line.quantity - 1)
                          }
                          aria-label="Decrease"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="w-8 text-center text-sm font-bold">{line.quantity}</span>
                        <button
                          type="button"
                          className="flex h-8 w-8 items-center justify-center rounded-md border border-border text-brand hover:bg-brand-soft"
                          onClick={() =>
                            setQty(store.businessId, line.productId, line.quantity + 1)
                          }
                          aria-label="Increase"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          className="ml-auto rounded-md p-2 text-muted hover:bg-bg-hover hover:text-danger"
                          onClick={() => removeItem(store.businessId, line.productId)}
                          aria-label="Remove"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    <p className="shrink-0 text-sm font-bold text-heading">
                      Rs {money(line.quantity * line.price)}
                    </p>
                  </li>
                ))}
              </ul>

              <div className="flex items-center justify-between border-t border-border px-4 py-3">
                <span className="text-sm font-semibold text-heading">
                  {t("marketplace.storeSubtotal")}
                </span>
                <span className="font-bold text-heading">Rs {money(storeTotal)}</span>
              </div>
            </BuyerCard>
          </BrandThemeScope>
        );
      })}

      <BuyerCard className="flex items-center justify-between p-4">
        <span className="font-semibold text-heading">{t("marketplace.grandTotal")}</span>
        <span className="text-lg font-bold text-heading">Rs {money(subtotal)}</span>
      </BuyerCard>

      <BrandThemeScope
        primaryColor={stores.length === 1 ? stores[0].branding?.primaryColor : null}
        className="flex flex-wrap gap-3"
      >
        <Link href="/app">
          <Button variant="secondary">{t("marketplace.keepShopping")}</Button>
        </Link>
        <Button className="flex-1 sm:flex-none" onClick={() => router.push("/app/checkout/pay")}>
          {t("marketplace.continue")}
        </Button>
      </BrandThemeScope>
    </div>
  );
}
