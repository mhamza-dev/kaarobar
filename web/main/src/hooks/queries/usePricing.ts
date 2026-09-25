import { useQuery } from "@tanstack/react-query";

import {
  createPriceList,
  createPromotion,
  deleteListPrice,
  deletePriceList,
  deletePromotion,
  getPriceList,
  listPriceLists,
  listPromotions,
  putListPrice,
  updatePriceList,
  updatePromotion,
} from "@/services/pricing";
import type { PriceListPayload, PriceRulePayload } from "@/types/api/pricing";

import { useTenantKey } from "./keys";
import { useInvalidatingMutation } from "./mutations";

// A price change shows up in quotes at the till, so those refresh as well.
const PRICING_KEYS = ["price-lists", "price-list", "promotions", "sale-quote"];

export function usePriceLists() {
  const tenant = useTenantKey();
  return useQuery({ queryKey: ["price-lists", tenant], queryFn: listPriceLists });
}
export function usePriceList(id: string | undefined) {
  return useQuery({
    queryKey: ["price-list", id],
    queryFn: () => getPriceList(id!),
    enabled: !!id,
  });
}
export function usePromotions() {
  const tenant = useTenantKey();
  return useQuery({ queryKey: ["promotions", tenant], queryFn: listPromotions });
}

export const useCreatePriceList = () =>
  useInvalidatingMutation<[PriceListPayload], unknown>(createPriceList, PRICING_KEYS);
export const useUpdatePriceList = () =>
  useInvalidatingMutation<[string, Partial<PriceListPayload>], unknown>(
    updatePriceList,
    PRICING_KEYS,
  );
export const useDeletePriceList = () =>
  useInvalidatingMutation<[string], unknown>(deletePriceList, PRICING_KEYS);
export const usePutListPrice = () =>
  useInvalidatingMutation<
    [string, { variant_id: string; price: string; min_quantity?: string | null }],
    unknown
  >(putListPrice, PRICING_KEYS);
export const useDeleteListPrice = () =>
  useInvalidatingMutation<[string, string], unknown>(deleteListPrice, PRICING_KEYS);
export const useCreatePromotion = () =>
  useInvalidatingMutation<[PriceRulePayload], unknown>(createPromotion, PRICING_KEYS);
export const useUpdatePromotion = () =>
  useInvalidatingMutation<[string, Partial<PriceRulePayload>], unknown>(
    updatePromotion,
    PRICING_KEYS,
  );
export const useDeletePromotion = () =>
  useInvalidatingMutation<[string], unknown>(deletePromotion, PRICING_KEYS);
