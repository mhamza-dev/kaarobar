"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api/client";
import { routes } from "@/lib/navigation";
import { DetailFieldGrid, DetailSection, DetailShell } from "@/components/app/DetailShell";

type Product = {
  id: string;
  sku: string;
  name: string;
  price?: string;
  cost?: string;
  barcode?: string | null;
  track_stock?: boolean;
  is_active?: boolean;
  category_name?: string | null;
  description?: string | null;
  stock_on_hand?: string | number | null;
};

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api<{ data: Product }>(`/products/${id}`);
      setProduct(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load product");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <DetailShell
      backHref={routes.inventory}
      backLabel="Back to inventory"
      eyebrow="Product"
      title={product?.name || "Product"}
      subtitle={product?.sku}
      status={
        product
          ? {
              label: product.is_active === false ? "Inactive" : "Active",
              tone: product.is_active === false ? "warning" : "success",
            }
          : undefined
      }
      loading={loading}
      error={error}
    >
      {product ? (
        <DetailSection title="Catalog">
          <DetailFieldGrid
            fields={[
              { label: "SKU", value: product.sku },
              { label: "Barcode", value: product.barcode || "—" },
              { label: "Category", value: product.category_name || "—" },
              { label: "Price", value: product.price ? `Rs ${product.price}` : "—" },
              { label: "Cost", value: product.cost ? `Rs ${product.cost}` : "—" },
              {
                label: "Stock",
                value:
                  product.stock_on_hand != null ? String(product.stock_on_hand) : "—",
              },
              {
                label: "Track stock",
                value: product.track_stock === false ? "No" : "Yes",
              },
            ]}
          />
          {product.description ? (
            <p className="mt-4 text-sm text-body">{product.description}</p>
          ) : null}
        </DetailSection>
      ) : null}
    </DetailShell>
  );
}
