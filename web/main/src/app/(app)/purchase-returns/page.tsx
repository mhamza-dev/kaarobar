"use client";

import { PageHeader } from "@/components/shared/PageHeader";
import { PurchaseReturnsTable } from "@/features/purchasing/PurchaseReturnsTable";

export default function PurchaseReturnsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Purchasing"
        title="Purchase returns"
        description="Goods sent back to a supplier."
      />
      <PurchaseReturnsTable />
    </>
  );
}
