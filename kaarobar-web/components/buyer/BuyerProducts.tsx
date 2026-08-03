"use client";

import {
  BuyerHero,
} from "@/components/buyer/BuyerLayout";
import BuyerProductFeed from "@/components/buyer/BuyerProductFeed";
import { useT } from "@/lib/i18n";

/** `/app/products` — same feed as Discover products mode. */
export default function BuyerProducts() {
  const t = useT();

  return (
    <div className="space-y-6">
      <BuyerHero
        eyebrow={t("marketplace.eyebrow")}
        title={t("pages.productsTitle")}
        description={t("pages.productsDesc")}
        infoKey="page.market.products"
      >
        <p className="mt-3 max-w-xl text-sm text-body">{t("marketplace.productsHero")}</p>
      </BuyerHero>
      <BuyerProductFeed />
    </div>
  );
}
