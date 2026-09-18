"use client";

import { PageHeader } from "@/components/shared/PageHeader";
import { SupplierBillsTable } from "@/features/purchasing/SupplierBillsTable";

export default function SupplierBillsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Purchasing"
        title="Supplier bills"
        description="What you owe, and how overdue it is."
      />
      <SupplierBillsTable />
    </>
  );
}
