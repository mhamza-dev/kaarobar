"use client";

import { use } from "react";

import { PageHeader } from "@/components/shared/PageHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { ProductForm } from "@/features/products/ProductForm";
import { ProductModifiersSection } from "@/features/products/VariantExtras";
import { VariantsSection } from "@/features/products/VariantsSection";
import { useProduct } from "@/hooks/queries/useProducts";
import { productKindLabel } from "@/lib/productKinds";
import { useSessionStore } from "@/stores/sessionStore";

export default function ProductDetailPage({ params }: PageProps<"/products/[productId]">) {
  const { productId } = use(params);
  const { data: product, isLoading, isError } = useProduct(productId);
  const modules = useSessionStore((state) => state.scope?.business?.modules) ?? [];

  return (
    <>
      <PageHeader
        eyebrow="Products"
        title={product?.name ?? "Product"}
        description={product ? productKindLabel(product.kind) : undefined}
        back={{ href: "/products", label: "All products" }}
      />

      {isLoading ? (
        <div className="flex max-w-2xl flex-col gap-4">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-9 w-full" />
          ))}
        </div>
      ) : isError || !product ? (
        <p className="text-sm text-muted-foreground">We couldn&apos;t load this product.</p>
      ) : (
        <>
          <ProductForm product={product} />
          <VariantsSection productId={product.id} product={product} />
          {modules.includes("modifiers") && <ProductModifiersSection product={product} />}
        </>
      )}
    </>
  );
}
