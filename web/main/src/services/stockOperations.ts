import { apiClient } from "@/lib/api/client";
import type { ApiEnvelope } from "@/types/api/common";
import type {
  CountPayload,
  StockCount,
  StockTransfer,
  TransferPayload,
} from "@/types/api/inventory";

// --- Transfers --------------------------------------------------------------

export async function listTransfers(
  params: { status?: string; branch_id?: string } = {},
): Promise<StockTransfer[]> {
  const response = await apiClient.get<ApiEnvelope<StockTransfer[]>>("/stock-transfers", {
    params,
  });
  return response.data.data;
}

export async function getTransfer(id: string): Promise<StockTransfer> {
  const response = await apiClient.get<ApiEnvelope<StockTransfer>>(`/stock-transfers/${id}`);
  return response.data.data;
}

export async function createTransfer(payload: TransferPayload): Promise<StockTransfer> {
  const response = await apiClient.post<ApiEnvelope<StockTransfer>>("/stock-transfers", payload);
  return response.data.data;
}

/**
 * The transfer lifecycle: dispatch takes stock out of the source branch,
 * receive puts it into the destination. Each is a separate permission and a
 * separate person — stock must not leave a branch on one person's say-so.
 */
export async function dispatchTransfer(id: string): Promise<StockTransfer> {
  const response = await apiClient.post<ApiEnvelope<StockTransfer>>(
    `/stock-transfers/${id}/dispatch`,
    {},
  );
  return response.data.data;
}

export async function receiveTransfer(
  id: string,
  payload: { items?: Array<{ id: string; received_quantity: string }> } = {},
): Promise<StockTransfer> {
  const response = await apiClient.post<ApiEnvelope<StockTransfer>>(
    `/stock-transfers/${id}/receive`,
    payload,
  );
  return response.data.data;
}

export async function cancelTransfer(id: string): Promise<StockTransfer> {
  const response = await apiClient.post<ApiEnvelope<StockTransfer>>(
    `/stock-transfers/${id}/cancel`,
    {},
  );
  return response.data.data;
}

// --- Counts -----------------------------------------------------------------

export async function listCounts(
  params: { status?: string; branch_id?: string } = {},
): Promise<StockCount[]> {
  const response = await apiClient.get<ApiEnvelope<StockCount[]>>("/stock-counts", { params });
  return response.data.data;
}

export async function getCount(id: string): Promise<StockCount> {
  const response = await apiClient.get<ApiEnvelope<StockCount>>(`/stock-counts/${id}`);
  return response.data.data;
}

export async function createCount(payload: CountPayload): Promise<StockCount> {
  const response = await apiClient.post<ApiEnvelope<StockCount>>("/stock-counts", payload);
  return response.data.data;
}

/** Records one counted line. The count stays open until submitted. */
export async function recordCountItem(
  countId: string,
  itemId: string,
  payload: { counted_quantity: string; reason?: string; note?: string },
): Promise<StockCount> {
  const response = await apiClient.put<ApiEnvelope<StockCount>>(
    `/stock-counts/${countId}/items/${itemId}`,
    payload,
  );
  return response.data.data;
}

export async function submitCount(id: string): Promise<StockCount> {
  const response = await apiClient.post<ApiEnvelope<StockCount>>(`/stock-counts/${id}/submit`, {});
  return response.data.data;
}

/**
 * Approving is what actually writes the variance into stock — and it is a
 * separate permission from counting, so the person who counted cannot sign
 * off their own discrepancy.
 */
export async function approveCount(id: string): Promise<StockCount> {
  const response = await apiClient.post<ApiEnvelope<StockCount>>(`/stock-counts/${id}/approve`, {});
  return response.data.data;
}

export async function cancelCount(id: string): Promise<StockCount> {
  const response = await apiClient.post<ApiEnvelope<StockCount>>(`/stock-counts/${id}/cancel`, {});
  return response.data.data;
}
