import { apiClient } from "@/lib/api/client";
import type { ApiEnvelope } from "@/types/api/common";
import type { Scope } from "@/types/api/me";

export async function getMe(): Promise<Scope> {
  const response = await apiClient.get<ApiEnvelope<Scope>>("/me");
  return response.data.data;
}
