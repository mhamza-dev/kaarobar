"use client";

import { PageHeader } from "@/components/shared/PageHeader";
import { CatalogSetupScreen } from "@/features/products/CatalogSetupScreen";

export default function CatalogSetupPage() {
  return (
    <>
      <PageHeader
        eyebrow="Catalog"
        title="Catalog set-up"
        description="Brands, units, the options variants are made of, and add-ons."
      />
      <CatalogSetupScreen />
    </>
  );
}
