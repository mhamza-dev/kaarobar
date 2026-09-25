import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { toast } from "@/hooks/useToast";
import { isNotFound } from "@/lib/api/errors";
import {
  activateGiftCard,
  getGiftCardHistory,
  getStoreCreditHistory,
  issueGiftCard,
  issueStoreCredit,
  redeemGiftCard,
  redeemStoreCredit,
  topUpGiftCard,
} from "@/services/prepaid";
import type { GiftCardPayload, StoreCreditPayload } from "@/types/api/crm";

/** Prepaid balances show on the customer too, so both are refreshed together. */
function usePrepaidMutation<TArgs extends unknown[], TResult>(
  mutationFn: (...args: TArgs) => Promise<TResult>,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (variables: TArgs) => mutationFn(...variables),
    onSuccess: () => {
      for (const key of ["gift-card", "store-credit", "customer"]) {
        queryClient.invalidateQueries({ queryKey: [key] });
      }
    },
    onError: (error) => toast.mutationError(error),
  });
}

/** A card looked up by code, with its history. A 404 means no such card. */
export function useGiftCard(code: string | null) {
  return useQuery({
    queryKey: ["gift-card", code],
    queryFn: () => getGiftCardHistory(code!),
    enabled: !!code,
    retry: (count, error) => !isNotFound(error) && count < 2,
  });
}

export const useIssueGiftCard = () => usePrepaidMutation<[GiftCardPayload], unknown>(issueGiftCard);
export const useActivateGiftCard = () => usePrepaidMutation<[string], unknown>(activateGiftCard);
export const useTopUpGiftCard = () =>
  usePrepaidMutation<[string, string, string?], unknown>(topUpGiftCard);
export const useRedeemGiftCard = () =>
  usePrepaidMutation<[string, string, string?], unknown>(redeemGiftCard);

export function useStoreCreditHistory(id: string | null) {
  return useQuery({
    queryKey: ["store-credit", id],
    queryFn: () => getStoreCreditHistory(id!),
    enabled: !!id,
  });
}

export const useIssueStoreCredit = () =>
  usePrepaidMutation<[string, StoreCreditPayload], unknown>(issueStoreCredit);
export const useRedeemStoreCredit = () =>
  usePrepaidMutation<[string, string, string?], unknown>(redeemStoreCredit);
