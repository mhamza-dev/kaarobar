import { apiClient } from "@/lib/api/client";
import type { ApiEnvelope, CursorParams, Paginated } from "@/types/api/common";
import type {
  Batch,
  OpeningStockPayload,
  ReorderSuggestion,
  StockAdjustPayload,
  StockItem,
  StockListParams,
  StockMove,
  StockMoveParams,
  StockSettingsPayload,
  StockValuation,
} from "@/types/api/inventory";

/** `GET /stock` — cursor-paginated; filters are backend query params. */
export async function listStock(
  params: StockListParams & CursorParams,
): Promise<Paginated<StockItem>> {
  const response = await apiClient.get<Paginated<StockItem>>("/stock", { params });
  return response.data;
}

/** `GET /stock/moves` — the ledger, also cursor-paginated. */
export async function listStockMoves(
  params: StockMoveParams & CursorParams,
): Promise<Paginated<StockMove>> {
  const response = await apiClient.get<Paginated<StockMove>>("/stock/moves", { params });
  return response.data;
}

/** One product's stock at one branch — a stock row is keyed by both. */
export async function getStockItem(branchId: string, variantId: string): Promise<StockItem> {
  const response = await apiClient.get<ApiEnvelope<StockItem>>(`/stock/${branchId}/${variantId}`);
  return response.data.data;
}

export async function updateStockSettings(
  branchId: string,
  variantId: string,
  payload: StockSettingsPayload,
): Promise<StockItem> {
  const response = await apiClient.put<ApiEnvelope<StockItem>>(
    `/stock/${branchId}/${variantId}`,
    payload,
  );
  return response.data.data;
}

/** Every move for one product at one branch, oldest first. */
export async function getStockLedger(branchId: string, variantId: string): Promise<StockMove[]> {
  const response = await apiClient.get<ApiEnvelope<StockMove[]>>(
    `/stock/${branchId}/${variantId}/ledger`,
  );
  return response.data.data;
}

export async function setOpeningStock(payload: OpeningStockPayload): Promise<StockMove> {
  const response = await apiClient.post<ApiEnvelope<StockMove>>("/stock/opening", payload);
  return response.data.data;
}

export async function getStockValuation(
  params: { branch_id?: string; category_id?: string } = {},
): Promise<StockValuation> {
  const response = await apiClient.get<ApiEnvelope<StockValuation>>("/stock/valuation", {
    params,
  });
  return response.data.data;
}

export async function listReorderSuggestions(
  params: { branch_id?: string } = {},
): Promise<ReorderSuggestion[]> {
  const response = await apiClient.get<ApiEnvelope<ReorderSuggestion[]>>("/stock/reorder", {
    params,
  });
  return response.data.data;
}

export async function adjustStock(payload: StockAdjustPayload): Promise<StockMove> {
  const response = await apiClient.post<ApiEnvelope<StockMove>>("/stock/adjust", payload);
  return response.data.data;
}

/**
 * `POST /stock/write-off` — wastage and breakage.
 *
 * Separate from `adjustStock` because the backend records a different move
 * kind and a different audit entry: "we miscounted" and "it broke" are not
 * the same event, and the valuation report tells them apart.
 */
export async function writeOffStock(payload: StockAdjustPayload): Promise<StockMove> {
  const response = await apiClient.post<ApiEnvelope<StockMove>>("/stock/write-off", payload);
  return response.data.data;
}

export async function listBatches(
  params: { variant_id?: string; status?: string; in_stock?: boolean } = {},
): Promise<Batch[]> {
  const response = await apiClient.get<ApiEnvelope<Batch[]>>("/batches", { params });
  return response.data.data;
}

/** `GET /batches/expiring` — what a pharmacy or grocer checks every morning. */
export async function listExpiringBatches(params: { days?: number } = {}): Promise<Batch[]> {
  const response = await apiClient.get<ApiEnvelope<Batch[]>>("/batches/expiring", { params });
  return response.data.data;
}

export async function setBatchStatus(id: string, status: string): Promise<Batch> {
  const response = await apiClient.put<ApiEnvelope<Batch>>(`/batches/${id}/status`, { status });
  return response.data.data;
}
