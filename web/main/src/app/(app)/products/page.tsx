"use client";

import { PageHeader } from "@/components/shared/PageHeader";
import { ProductsTable } from "@/features/products/ProductsTable";

export default function ProductsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Catalog"
        title="Products"
        description="Everything this business sells."
      />
      <ProductsTable />
    </>
  );
}
