"use client";

import { use } from "react";

import { PageHeader } from "@/components/shared/PageHeader";
import { SaleDetail } from "@/features/sales/SaleDetail";

export default function SaleDetailPage({ params }: PageProps<"/sales/[saleId]">) {
  const { saleId } = use(params);

  return (
    <>
      <PageHeader eyebrow="Sales" title="Sale" back={{ href: "/sales", label: "All sales" }} />
      <SaleDetail saleId={saleId} />
    </>
  );
}
