import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { toast } from "@/hooks/useToast";
import { flattenPages, getNextCursorParam } from "@/lib/api/pagination";
import {
  adjustStock,
  listBatches,
  listExpiringBatches,
  listStock,
  listStockMoves,
  setBatchStatus,
  writeOffStock,
} from "@/services/inventory";
import type { StockAdjustPayload, StockListParams, StockMoveParams } from "@/types/api/inventory";

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
    },
    onError: (error) => toast.mutationError(error),
  });
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
