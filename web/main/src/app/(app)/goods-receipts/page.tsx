"use client";

import { PageHeader } from "@/components/shared/PageHeader";
import { GoodsReceiptsTable } from "@/features/purchasing/GoodsReceiptsTable";

export default function GoodsReceiptsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Purchasing"
        title="Goods receipts"
        description="Deliveries recorded against orders. Stock moves when a receipt is posted."
      />
      <GoodsReceiptsTable />
    </>
  );
}
