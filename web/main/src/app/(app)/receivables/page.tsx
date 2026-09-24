"use client";

import { PageHeader } from "@/components/shared/PageHeader";
import { ReceivablesReport } from "@/features/customers/ReceivablesReport";

export default function ReceivablesPage() {
  return (
    <>
      <PageHeader
        eyebrow="Customers"
        title="Receivables"
        description="What customers owe, by how late it is."
      />
      <ReceivablesReport />
    </>
  );
}
