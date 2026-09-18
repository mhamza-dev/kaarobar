"use client";

import { PageHeader } from "@/components/shared/PageHeader";
import { ProductForm } from "@/features/products/ProductForm";

export default function NewProductPage() {
  return (
    <>
      <PageHeader
        eyebrow="Products"
        title="New product"
        description="Pick the kind first — it decides which settings apply."
      />
      <ProductForm />
    </>
  );
}
