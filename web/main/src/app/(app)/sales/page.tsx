"use client";

import { PageHeader } from "@/components/shared/PageHeader";
import { SalesTable } from "@/features/sales/SalesTable";

export default function SalesPage() {
  return (
    <>
      <PageHeader
        eyebrow="Sell"
        title="Sales"
        description="Every completed sale, for lookup, void and refund."
      />
      <SalesTable />
    </>
  );
}
