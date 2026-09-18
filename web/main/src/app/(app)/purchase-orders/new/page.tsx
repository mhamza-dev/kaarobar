"use client";

import { PageHeader } from "@/components/shared/PageHeader";
import { PurchaseOrderForm } from "@/features/purchasing/PurchaseOrderForm";

export default function NewPurchaseOrderPage() {
  return (
    <>
      <PageHeader
        eyebrow="Purchase orders"
        title="New purchase order"
        description="Creates a draft. Nothing is committed until it's approved."
      />
      <PurchaseOrderForm />
    </>
  );
}
