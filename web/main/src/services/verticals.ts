import { apiClient } from "@/lib/api/client";
import type { ApiEnvelope } from "@/types/api/common";
import type { BusinessTypesResponse } from "@/types/api/verticals";

/** Public — no auth/tenant headers needed, callable from the registration form. */
export async function getBusinessTypes(): Promise<BusinessTypesResponse> {
  const response = await apiClient.get<ApiEnvelope<BusinessTypesResponse>>("/business-types");
  return response.data.data;
}
