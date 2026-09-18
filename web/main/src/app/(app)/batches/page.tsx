"use client";

import { PageHeader } from "@/components/shared/PageHeader";
import { BatchesTable } from "@/features/inventory/BatchesTable";

export default function BatchesPage() {
  return (
    <>
      <PageHeader
        eyebrow="Inventory"
        title="Batches"
        description="Lot numbers and expiry dates. Expired stock can't be sold."
      />
      <BatchesTable />
    </>
  );
}
