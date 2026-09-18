"use client";

import { PageHeader } from "@/components/shared/PageHeader";
import { CategoriesTable } from "@/features/products/CategoriesTable";

export default function CategoriesPage() {
  return (
    <>
      <PageHeader
        eyebrow="Catalog"
        title="Categories"
        description="How products are grouped in the catalog and on the counter."
      />
      <CategoriesTable />
    </>
  );
}
