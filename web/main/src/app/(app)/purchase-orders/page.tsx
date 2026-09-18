"use client";

import { PageHeader } from "@/components/shared/PageHeader";
import { PurchaseOrdersTable } from "@/features/purchasing/PurchaseOrdersTable";

export default function PurchaseOrdersPage() {
  return (
    <>
      <PageHeader
        eyebrow="Purchasing"
        title="Purchase orders"
        description="What you've ordered, what's arrived, and what's still outstanding."
      />
      <PurchaseOrdersTable />
    </>
  );
}
