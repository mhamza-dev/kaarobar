"use client";

import { use } from "react";

import { PageHeader } from "@/components/shared/PageHeader";
import { PriceListDetail } from "@/features/pricing/PriceLists";

export default function PriceListPage({ params }: PageProps<"/price-lists/[listId]">) {
  const { listId } = use(params);

  return (
    <>
      <PageHeader
        eyebrow="Price lists"
        title="Price list"
        back={{ href: "/price-lists", label: "All price lists" }}
      />
      <PriceListDetail listId={listId} />
    </>
  );
}
