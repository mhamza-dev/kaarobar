"use client";

import { PageHeader } from "@/components/shared/PageHeader";
import { SuppliersTable } from "@/features/purchasing/SuppliersTable";

export default function SuppliersPage() {
  return (
    <>
      <PageHeader
        eyebrow="Purchasing"
        title="Suppliers"
        description="Who you buy from, and what you currently owe them."
      />
      <SuppliersTable />
    </>
  );
}
