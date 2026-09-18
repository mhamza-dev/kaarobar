"use client";

import { PageHeader } from "@/components/shared/PageHeader";
import { StockTable } from "@/features/inventory/StockTable";

export default function StockPage() {
  return (
    <>
      <PageHeader
        eyebrow="Inventory"
        title="Stock"
        description="What's on hand at each branch, and what's actually available to sell."
      />
      <StockTable />
    </>
  );
}
