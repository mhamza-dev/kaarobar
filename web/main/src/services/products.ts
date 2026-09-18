import { apiClient } from "@/lib/api/client";
import type { ApiEnvelope, CursorParams, Paginated } from "@/types/api/common";
import type {
  Product,
  ProductListParams,
  ProductPayload,
  ProductVariant,
  VariantPayload,
} from "@/types/api/catalog";

/**
 * `GET /products` — **cursor-paginated**, unlike the Phase 1 lists.
 *
 * Filters go to the backend as real query params (`q`, `kind`,
 * `category_id`, `active` — ProductController's `@filter_keys`) rather than
 * being applied client-side: a catalog is routinely larger than the pages
 * loaded so far, so filtering only what's on screen would give a confidently
 * wrong answer.
 */
export async function listProducts(
  params: ProductListParams & CursorParams,
): Promise<Paginated<Product>> {
  const response = await apiClient.get<Paginated<Product>>("/products", { params });
  return response.data;
}

export async function getProduct(id: string): Promise<Product> {
  const response = await apiClient.get<ApiEnvelope<Product>>(`/products/${id}`);
  return response.data.data;
}

export async function createProduct(payload: ProductPayload): Promise<Product> {
  const response = await apiClient.post<ApiEnvelope<Product>>("/products", payload);
  return response.data.data;
}

export async function updateProduct(id: string, payload: ProductPayload): Promise<Product> {
  const response = await apiClient.patch<ApiEnvelope<Product>>(`/products/${id}`, payload);
  return response.data.data;
}

export async function deleteProduct(id: string): Promise<void> {
  await apiClient.delete(`/products/${id}`);
}

/** `GET /products/scan/:barcode` — returns the *variant*, which is what sells. */
export async function scanBarcode(barcode: string): Promise<ProductVariant> {
  const response = await apiClient.get<ApiEnvelope<ProductVariant>>(
    `/products/scan/${encodeURIComponent(barcode)}`,
  );
  return response.data.data;
}

export async function listVariants(productId: string): Promise<ProductVariant[]> {
  const response = await apiClient.get<ApiEnvelope<ProductVariant[]>>(
    `/products/${productId}/variants`,
  );
  return response.data.data;
}

export async function createVariant(
  productId: string,
  payload: VariantPayload,
): Promise<ProductVariant> {
  const response = await apiClient.post<ApiEnvelope<ProductVariant>>(
    `/products/${productId}/variants`,
    payload,
  );
  return response.data.data;
}

export async function updateVariant(id: string, payload: VariantPayload): Promise<ProductVariant> {
  const response = await apiClient.patch<ApiEnvelope<ProductVariant>>(`/variants/${id}`, payload);
  return response.data.data;
}

export async function deleteVariant(id: string): Promise<void> {
  await apiClient.delete(`/variants/${id}`);
}
