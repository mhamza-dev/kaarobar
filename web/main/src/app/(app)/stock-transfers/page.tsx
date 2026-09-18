"use client";

import { PageHeader } from "@/components/shared/PageHeader";
import { TransfersTable } from "@/features/inventory/TransfersTable";

export default function StockTransfersPage() {
  return (
    <>
      <PageHeader
        eyebrow="Inventory"
        title="Stock transfers"
        description="Moving stock between branches: created, dispatched, then received."
      />
      <TransfersTable />
    </>
  );
}
