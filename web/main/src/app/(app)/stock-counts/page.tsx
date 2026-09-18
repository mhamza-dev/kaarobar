"use client";

import { PageHeader } from "@/components/shared/PageHeader";
import { CountsTable } from "@/features/inventory/CountsTable";

export default function StockCountsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Inventory"
        title="Stock counts"
        description="Counting what's really on the shelf, and approving the difference."
      />
      <CountsTable />
    </>
  );
}
