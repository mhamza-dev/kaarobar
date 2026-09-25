import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { toast } from "@/hooks/useToast";
import { flattenPages, getNextCursorParam } from "@/lib/api/pagination";
import {
  adjustStock,
  getStockItem,
  getStockLedger,
  getStockValuation,
  listBatches,
  listExpiringBatches,
  listReorderSuggestions,
  listStock,
  listStockMoves,
  setBatchStatus,
  setOpeningStock,
  updateStockSettings,
  writeOffStock,
} from "@/services/inventory";
import type {
  OpeningStockPayload,
  StockAdjustPayload,
  StockListParams,
  StockMoveParams,
  StockSettingsPayload,
} from "@/types/api/inventory";

import { useTenantKey } from "./keys";

export function useStockList(params: StockListParams = {}) {
  const tenant = useTenantKey();

  const query = useInfiniteQuery({
    queryKey: ["stock", tenant, params],
    queryFn: ({ pageParam }) => listStock({ ...params, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: getNextCursorParam,
  });

  return { ...query, rows: flattenPages(query.data?.pages) };
}

export function useStockMoves(params: StockMoveParams = {}) {
  const tenant = useTenantKey();

  const query = useInfiniteQuery({
    queryKey: ["stock-moves", tenant, params],
    queryFn: ({ pageParam }) => listStockMoves({ ...params, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: getNextCursorParam,
  });

  return { ...query, rows: flattenPages(query.data?.pages) };
}

/**
 * Anything that moves stock invalidates the level, the ledger and batches
 * together — they are three views of one fact, and leaving any of them
 * stale shows a quantity that contradicts the move that just happened.
 */
function useStockMutation<TArgs extends unknown[], TResult>(
  mutationFn: (...args: TArgs) => Promise<TResult>,
) {
  const queryClient = useQueryClient();
  const tenant = useTenantKey();

  return useMutation({
    mutationFn: (variables: TArgs) => mutationFn(...variables),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stock", tenant] });
      queryClient.invalidateQueries({ queryKey: ["stock-moves", tenant] });
      queryClient.invalidateQueries({ queryKey: ["batches", tenant] });
      queryClient.invalidateQueries({ queryKey: ["batches-expiring", tenant] });
      for (const key of ["stock-item", "stock-ledger", "stock-valuation", "stock-reorder"]) {
        queryClient.invalidateQueries({ queryKey: [key] });
      }
    },
    onError: (error) => toast.mutationError(error),
  });
}

export function useStockItem(branchId: string | undefined, variantId: string | undefined) {
  return useQuery({
    queryKey: ["stock-item", branchId, variantId],
    queryFn: () => getStockItem(branchId!, variantId!),
    enabled: !!branchId && !!variantId,
  });
}

export function useStockLedger(branchId: string | undefined, variantId: string | undefined) {
  return useQuery({
    queryKey: ["stock-ledger", branchId, variantId],
    queryFn: () => getStockLedger(branchId!, variantId!),
    enabled: !!branchId && !!variantId,
  });
}

export function useStockValuation(params: { branch_id?: string } = {}, enabled = true) {
  const tenant = useTenantKey();
  return useQuery({
    queryKey: ["stock-valuation", tenant, params],
    queryFn: () => getStockValuation(params),
    enabled,
  });
}

export function useReorderSuggestions(params: { branch_id?: string } = {}) {
  const tenant = useTenantKey();
  return useQuery({
    queryKey: ["stock-reorder", tenant, params],
    queryFn: () => listReorderSuggestions(params),
  });
}

export function useUpdateStockSettings() {
  return useStockMutation<[string, string, StockSettingsPayload], unknown>(updateStockSettings);
}

export function useSetOpeningStock() {
  return useStockMutation<[OpeningStockPayload], unknown>(setOpeningStock);
}

export function useAdjustStock() {
  return useStockMutation<[StockAdjustPayload], unknown>(adjustStock);
}

export function useWriteOffStock() {
  return useStockMutation<[StockAdjustPayload], unknown>(writeOffStock);
}

export function useBatches(params: { variant_id?: string; status?: string } = {}) {
  const tenant = useTenantKey();

  return useQuery({
    queryKey: ["batches", tenant, params],
    queryFn: () => listBatches(params),
  });
}

export function useExpiringBatches(days = 30) {
  const tenant = useTenantKey();

  return useQuery({
    queryKey: ["batches-expiring", tenant, days],
    queryFn: () => listExpiringBatches({ days }),
  });
}

export function useSetBatchStatus() {
  return useStockMutation<[string, string], unknown>(setBatchStatus);
}
