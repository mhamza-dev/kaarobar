"use client";

import { PageHeader } from "@/components/shared/PageHeader";
import { TaxesScreen } from "@/features/settings/TaxesScreen";

export default function TaxesPage() {
  return (
    <>
      <PageHeader
        eyebrow="Settings"
        title="Taxes"
        description="What each product is taxed, and how it's printed on receipts."
      />
      <TaxesScreen />
    </>
  );
}
