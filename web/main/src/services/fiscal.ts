import { apiClient } from "@/lib/api/client";
import type { ApiEnvelope } from "@/types/api/common";
import type {
  FiscalConfig,
  FiscalConfigPayload,
  FiscalStatus,
  FiscalSubmission,
} from "@/types/api/fiscal";

async function get<T>(path: string, params?: object): Promise<T> {
  const response = await apiClient.get<ApiEnvelope<T>>(path, { params });
  return response.data.data;
}

/** `null` when the business has never connected to a tax authority. */
export const getFiscalConfig = () => get<FiscalConfig | null>("/fiscal/config");

export async function saveFiscalConfig(payload: FiscalConfigPayload): Promise<FiscalConfig> {
  const response = await apiClient.put<ApiEnvelope<FiscalConfig>>("/fiscal/config", payload);
  return response.data.data;
}

export const disableFiscal = () => apiClient.delete("/fiscal/config");

export const getFiscalStatus = () => get<FiscalStatus>("/fiscal/status");

export const listFiscalSubmissions = (
  params: { status?: string; needs_attention?: boolean } = {},
) => get<FiscalSubmission[]>("/fiscal/submissions", params);

export async function retrySubmission(id: string): Promise<unknown> {
  const response = await apiClient.post<ApiEnvelope<unknown>>(
    `/fiscal/submissions/${id}/retry`,
    {},
  );
  return response.data.data;
}

export async function retryAllSubmissions(): Promise<unknown> {
  const response = await apiClient.post<ApiEnvelope<unknown>>("/fiscal/retry", {});
  return response.data.data;
}
