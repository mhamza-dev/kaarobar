import { apiClient } from "@/lib/api/client";
import type { ApiEnvelope } from "@/types/api/common";
import type { Organization } from "@/types/api/tenancy";

/** `GET /organization` — the caller's current organization, per the tenant headers. */
export async function getOrganization(): Promise<Organization> {
  const response = await apiClient.get<ApiEnvelope<Organization>>("/organization");
  return response.data.data;
}

export async function updateOrganization(payload: Partial<Organization>): Promise<Organization> {
  const response = await apiClient.patch<ApiEnvelope<Organization>>("/organization", payload);
  return response.data.data;
}
