import { apiClient } from "@/lib/api/client";
import type { ApiEnvelope } from "@/types/api/common";
import type {
  PriceList,
  PriceListItem,
  PriceListPayload,
  PriceRule,
  PriceRulePayload,
} from "@/types/api/pricing";

const get = async <T>(url: string) => (await apiClient.get<ApiEnvelope<T>>(url)).data.data;

export const listPriceLists = () => get<PriceList[]>("/price-lists");
export const getPriceList = (id: string) => get<PriceList>(`/price-lists/${id}`);

export async function createPriceList(payload: PriceListPayload): Promise<PriceList> {
  return (await apiClient.post<ApiEnvelope<PriceList>>("/price-lists", payload)).data.data;
}
export async function updatePriceList(
  id: string,
  payload: Partial<PriceListPayload>,
): Promise<PriceList> {
  return (await apiClient.patch<ApiEnvelope<PriceList>>(`/price-lists/${id}`, payload)).data.data;
}
export async function deletePriceList(id: string): Promise<void> {
  await apiClient.delete(`/price-lists/${id}`);
}

/** Sets one variant's price on the list — adds it, or replaces what was there. */
export async function putListPrice(
  listId: string,
  payload: { variant_id: string; price: string; min_quantity?: string | null },
): Promise<PriceListItem> {
  return (await apiClient.put<ApiEnvelope<PriceListItem>>(`/price-lists/${listId}/prices`, payload))
    .data.data;
}
export async function deleteListPrice(listId: string, variantId: string): Promise<void> {
  await apiClient.delete(`/price-lists/${listId}/prices/${variantId}`);
}

export const listPromotions = () => get<PriceRule[]>("/promotions");
export async function createPromotion(payload: PriceRulePayload): Promise<PriceRule> {
  return (await apiClient.post<ApiEnvelope<PriceRule>>("/promotions", payload)).data.data;
}
export async function updatePromotion(
  id: string,
  payload: Partial<PriceRulePayload>,
): Promise<PriceRule> {
  return (await apiClient.patch<ApiEnvelope<PriceRule>>(`/promotions/${id}`, payload)).data.data;
}
export async function deletePromotion(id: string): Promise<void> {
  await apiClient.delete(`/promotions/${id}`);
}
