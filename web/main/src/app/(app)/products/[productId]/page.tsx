"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { use } from "react";

import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ProductForm } from "@/features/products/ProductForm";
import { VariantsSection } from "@/features/products/VariantsSection";
import { useProduct } from "@/hooks/queries/useProducts";
import { productKindLabel } from "@/lib/productKinds";

export default function ProductDetailPage({ params }: PageProps<"/products/[productId]">) {
  const { productId } = use(params);
  const { data: product, isLoading, isError } = useProduct(productId);

  return (
    <>
      <PageHeader
        eyebrow="Products"
        title={product?.name ?? "Product"}
        description={product ? productKindLabel(product.kind) : undefined}
        actions={
          <Button variant="outline" nativeButton={false} render={<Link href="/products" />}>
            <ArrowLeft className="size-4" />
            All products
          </Button>
        }
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
          <VariantsSection productId={product.id} />
        </>
      )}
    </>
  );
}
