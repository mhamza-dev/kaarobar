"use client";

import { use } from "react";

import { PageHeader } from "@/components/shared/PageHeader";
import { PurchaseReturnDetail } from "@/features/purchasing/PurchaseReturnDetail";

export default function PurchaseReturnDetailPage({
  params,
}: PageProps<"/purchase-returns/[returnId]">) {
  const { returnId } = use(params);

  return (
    <>
      <PageHeader
        eyebrow="Purchase returns"
        title="Purchase return"
        back={{ href: "/purchase-returns", label: "All returns" }}
      />
      <PurchaseReturnDetail returnId={returnId} />
    </>
  );
}
