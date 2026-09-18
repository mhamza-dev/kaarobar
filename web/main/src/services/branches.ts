import { apiClient } from "@/lib/api/client";
import type { ApiEnvelope } from "@/types/api/common";
import type { Branch } from "@/types/api/tenancy";

export async function listBranches(): Promise<Branch[]> {
  const response = await apiClient.get<ApiEnvelope<Branch[]>>("/branches");
  return response.data.data;
}

export async function getBranch(id: string): Promise<Branch> {
  const response = await apiClient.get<ApiEnvelope<Branch>>(`/branches/${id}`);
  return response.data.data;
}

export async function createBranch(payload: Partial<Branch>): Promise<Branch> {
  const response = await apiClient.post<ApiEnvelope<Branch>>("/branches", payload);
  return response.data.data;
}

export async function updateBranch(id: string, payload: Partial<Branch>): Promise<Branch> {
  const response = await apiClient.patch<ApiEnvelope<Branch>>(`/branches/${id}`, payload);
  return response.data.data;
}

export async function deleteBranch(id: string): Promise<void> {
  await apiClient.delete(`/branches/${id}`);
}

/** Promotes a branch to the business's main branch — demotes the previous one. */
export async function setMainBranch(id: string): Promise<Branch> {
  const response = await apiClient.post<ApiEnvelope<Branch>>(`/branches/${id}/main`, {});
  return response.data.data;
}
