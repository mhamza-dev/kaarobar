"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { DataTable, type DataTableColumn } from "@/components/shared/DataTable/DataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCategoriesList } from "@/hooks/queries/useCategories";
import { useProductsList } from "@/hooks/queries/useProducts";
import { useDebounce } from "@/hooks/useDebounce";
import { usePermission } from "@/hooks/usePermission";
import { productKindLabel } from "@/lib/productKinds";
import { PRODUCT_KINDS, type Product, type ProductKind } from "@/types/api/catalog";

/**
 * The catalog list — and the first screen where filtering is the
 * **backend's** job.
 *
 * A product list outgrows the loaded pages routinely, so `q`, `kind` and
 * `category_id` go out as real query params (`serverSearch` on `DataTable`,
 * not its client-side `search`). Anything else would search only the rows
 * already fetched and quietly miss the rest of the catalog.
 */
export function ProductsTable() {
  const router = useRouter();
  const { can } = usePermission();

  const [search, setSearch] = useState("");
  const [kind, setKind] = useState<ProductKind | "">("");
  const [categoryId, setCategoryId] = useState("");

  // Debounced so typing doesn't fire a request per keystroke.
  const debouncedSearch = useDebounce(search, 300);
  const { data: categories } = useCategoriesList();

  const { rows, isLoading, error, refetch, hasNextPage, isFetchingNextPage, fetchNextPage } =
    useProductsList({
      q: debouncedSearch || undefined,
      kind: kind || undefined,
      category_id: categoryId || undefined,
    });

  const canCreate = can("product:create");

  const columns: DataTableColumn<Product>[] = [
    {
      key: "name",
      header: "Product",
      render: (product) => (
        <div className="flex items-center gap-2">
          <span className="font-medium">{product.name}</span>
          {!product.is_active && <Badge variant="outline">Inactive</Badge>}
        </div>
      ),
    },
    {
      key: "kind",
      header: "Kind",
      render: (product) => <Badge variant="secondary">{productKindLabel(product.kind)}</Badge>,
    },
    {
      key: "category",
      header: "Category",
      render: (product) => product.category?.name ?? "—",
    },
    {
      key: "stock",
      header: "Tracking",
      render: (product) =>
        product.tracks_stock ? (
          <div className="flex gap-1">
            <Badge variant="outline">Stock</Badge>
            {product.tracks_batch && <Badge variant="outline">Batch</Badge>}
            {product.tracks_serial && <Badge variant="outline">Serial</Badge>}
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: "variants",
      header: "Variants",
      align: "end",
      render: (product) => product.variants?.length ?? "—",
    },
  ];

  return (
    <>
      {canCreate && (
        <div className="mb-3 flex justify-end">
          <Button nativeButton={false} render={<Link href="/products/new" />}>
            <Plus className="size-4" />
            New product
          </Button>
        </div>
      )}

      <div className="mb-3 flex flex-wrap gap-2">
        <select
          value={kind}
          onChange={(event) => setKind(event.target.value as ProductKind | "")}
          aria-label="Filter by kind"
          className="h-9 rounded-lg border border-border bg-background px-2 text-sm"
        >
          <option value="">All kinds</option>
          {PRODUCT_KINDS.map((option) => (
            <option key={option} value={option}>
              {productKindLabel(option)}
            </option>
          ))}
        </select>

        <select
          value={categoryId}
          onChange={(event) => setCategoryId(event.target.value)}
          aria-label="Filter by category"
          className="h-9 rounded-lg border border-border bg-background px-2 text-sm"
        >
          <option value="">All categories</option>
          {(categories ?? []).map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(product) => product.id}
        loading={isLoading}
        error={error ? { message: error.message } : null}
        onRetry={() => refetch()}
        serverSearch={{
          value: search,
          onChange: setSearch,
          placeholder: "Search name, SKU or barcode…",
        }}
        hasMore={hasNextPage}
        loadingMore={isFetchingNextPage}
        onLoadMore={() => fetchNextPage()}
        onRowClick={(product) => router.push(`/products/${product.id}`)}
        mobileCardTitle={(product) => product.name}
        mobileCardSubtitle={(product) => productKindLabel(product.kind)}
        mobileCardFields={[
          {
            key: "category",
            label: "Category",
            render: (product) => product.category?.name ?? "—",
          },
        ]}
      />
    </>
  );
}
