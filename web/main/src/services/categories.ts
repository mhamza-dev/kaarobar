import { apiClient } from "@/lib/api/client";
import type { ApiEnvelope } from "@/types/api/common";
import type { Category, CategoryPayload } from "@/types/api/catalog";

/** `GET /categories` — the whole tree at once, not paginated. */
export async function listCategories(): Promise<Category[]> {
  const response = await apiClient.get<ApiEnvelope<Category[]>>("/categories");
  return response.data.data;
}

export async function createCategory(payload: CategoryPayload): Promise<Category> {
  const response = await apiClient.post<ApiEnvelope<Category>>("/categories", payload);
  return response.data.data;
}

export async function updateCategory(
  id: string,
  payload: Partial<CategoryPayload>,
): Promise<Category> {
  const response = await apiClient.patch<ApiEnvelope<Category>>(`/categories/${id}`, payload);
  return response.data.data;
}

export async function deleteCategory(id: string): Promise<void> {
  await apiClient.delete(`/categories/${id}`);
}
