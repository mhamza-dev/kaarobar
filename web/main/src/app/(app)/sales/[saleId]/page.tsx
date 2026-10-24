"use client";

import { use } from "react";

import { PageHeader } from "@/components/shared/PageHeader";
import { SaleDetail } from "@/features/sales/SaleDetail";
import { useSale } from "@/hooks/queries/useSales";

export default function SaleDetailPage({ params }: PageProps<"/sales/[saleId]">) {
  const { saleId } = use(params);
  // Shares SaleDetail's cache entry — no second request — so the tab can
  // say which sale it is.
  const { data: sale } = useSale(saleId);

  return (
    <>
      <PageHeader
        eyebrow="Sales"
        title="Sale"
        documentTitle={sale?.number ?? "Sale"}
        back={{ href: "/sales", label: "All sales" }}
        compact
      />
      <SaleDetail saleId={saleId} />
    </>
  );
}
