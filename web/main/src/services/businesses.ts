import { apiClient } from "@/lib/api/client";
import type { ApiEnvelope } from "@/types/api/common";
import type { Business } from "@/types/api/tenancy";

/** `GET /businesses` — a plain array, not cursor-paginated (an org has few businesses). */
export async function listBusinesses(): Promise<Business[]> {
  const response = await apiClient.get<ApiEnvelope<Business[]>>("/businesses");
  return response.data.data;
}

export async function getBusiness(id: string): Promise<Business> {
  const response = await apiClient.get<ApiEnvelope<Business>>(`/businesses/${id}`);
  return response.data.data;
}

export async function updateBusiness(id: string, payload: Partial<Business>): Promise<Business> {
  const response = await apiClient.patch<ApiEnvelope<Business>>(`/businesses/${id}`, payload);
  return response.data.data;
}
