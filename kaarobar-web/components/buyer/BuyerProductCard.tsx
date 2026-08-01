"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import {
  BuyerCard,
  formatMarketplacePrice,
  marketplaceProductCategory,
} from "@/components/buyer/BuyerLayout";
import { useT } from "@/lib/i18n";

export type MarketplaceProductCardItem = {
  id: string;
  name: string;
  price?: string | number | null;
  image_url?: string | null;
  category?: string | null;
  category_ref?: { name?: string | null } | null;
  business_id?: string;
  business_slug?: string | null;
  business_name?: string | null;
  primary_color?: string | null;
};

type Props = {
  product: MarketplaceProductCardItem;
  href: string;
  showStore?: boolean;
  accent?: string | null;
  onQuickAdd?: () => void;
  quickAdding?: boolean;
};

/** Large product tile used on Products feed and store grids. */
export default function BuyerProductCard({
  product,
  href,
  showStore = false,
  accent,
  onQuickAdd,
  quickAdding,
}: Props) {
  const t = useT();
  const category = marketplaceProductCategory(product);
  const color = accent || product.primary_color || undefined;

  return (
    <BuyerCard as="article" hover className="group relative flex h-full flex-col" accent={color}>
      <div className="relative aspect-[4/3] overflow-hidden bg-bg-secondary">
        <Link href={href} className="absolute inset-0" aria-label={product.name}>
          {product.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={product.image_url}
              alt=""
              className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
            />
          ) : (
            <div
              className="flex h-full w-full items-center justify-center text-sm font-medium text-muted"
              style={
                color
                  ? { background: `linear-gradient(145deg, ${color}14 0%, transparent 70%)` }
                  : undefined
              }
            >
              {t("marketplace.noImage")}
            </div>
          )}
        </Link>
        {onQuickAdd ? (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onQuickAdd();
            }}
            className="absolute bottom-3 end-3 z-10 inline-flex h-11 min-w-11 items-center justify-center gap-1 rounded-full bg-brand px-3.5 text-sm font-bold text-brand-foreground shadow-md transition hover:brightness-110 active:scale-95"
            aria-label={t("marketplace.quickAdd")}
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} />
            <span className="hidden sm:inline">{t("marketplace.quickAdd")}</span>
          </button>
        ) : null}
        {quickAdding ? (
          <span className="pointer-events-none absolute inset-0 z-20 bg-card/40" aria-hidden />
        ) : null}
      </div>
      <Link href={href} className="flex flex-1 flex-col gap-1.5 p-3.5 text-left sm:p-4">
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted">
          {category}
        </p>
        <p className="line-clamp-2 text-[15px] font-semibold leading-snug text-heading">
          {product.name}
        </p>
        {showStore && product.business_name ? (
          <p className="line-clamp-1 text-xs text-body">{product.business_name}</p>
        ) : null}
        <p className="mt-auto pt-2 text-lg font-bold tracking-tight text-heading">
          Rs {formatMarketplacePrice(product.price)}
        </p>
      </Link>
    </BuyerCard>
  );
}
