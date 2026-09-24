import { apiClient } from "@/lib/api/client";
import type { ApiEnvelope } from "@/types/api/common";
import type {
  PaymentIntent,
  PaymentProvider,
  PaymentProviderPayload,
  Settlement,
} from "@/types/api/payments";

async function get<T>(path: string, params?: object): Promise<T> {
  const response = await apiClient.get<ApiEnvelope<T>>(path, { params });
  return response.data.data;
}

async function post<T>(path: string, body: object = {}): Promise<T> {
  const response = await apiClient.post<ApiEnvelope<T>>(path, body);
  return response.data.data;
}

export const listProviders = () => get<PaymentProvider[]>("/payments/providers");

export const createProvider = (payload: PaymentProviderPayload) =>
  post<PaymentProvider>("/payments/providers", payload);

export async function updateProvider(
  id: string,
  payload: PaymentProviderPayload,
): Promise<PaymentProvider> {
  const response = await apiClient.patch<ApiEnvelope<PaymentProvider>>(
    `/payments/providers/${id}`,
    payload,
  );
  return response.data.data;
}

export const deleteProvider = (id: string) => apiClient.delete(`/payments/providers/${id}`);

export const listPaymentIntents = (params: { status?: string } = {}) =>
  get<PaymentIntent[]>("/payments", params);

export const getPaymentIntent = (id: string) => get<PaymentIntent>(`/payments/${id}`);

/** Asks the gateway for the payment's current state — for one stuck waiting on a webhook. */
export const syncPaymentIntent = (id: string) => post<PaymentIntent>(`/payments/${id}/sync`);

/** Refunds through the gateway — part or all of what was captured. */
export const refundPaymentIntent = (id: string, amount: string) =>
  post<PaymentIntent>(`/payments/${id}/refund`, { amount });

export const listSettlements = () => get<Settlement[]>("/payments/settlements");

export const reconcileSettlement = (id: string, notes?: string) =>
  post<Settlement>(`/payments/settlements/${id}/reconcile`, { notes });
