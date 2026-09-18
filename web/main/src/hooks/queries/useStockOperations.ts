import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { toast } from "@/hooks/useToast";
import {
  approveCount,
  cancelCount,
  cancelTransfer,
  createCount,
  createTransfer,
  dispatchTransfer,
  getCount,
  getTransfer,
  listCounts,
  listTransfers,
  receiveTransfer,
  recordCountItem,
  submitCount,
} from "@/services/stockOperations";
import type { CountPayload, TransferPayload } from "@/types/api/inventory";

import { useTenantKey } from "./keys";

// --- Transfers --------------------------------------------------------------

export function useTransfers(params: { status?: string; branch_id?: string } = {}) {
  const tenant = useTenantKey();

  return useQuery({
    queryKey: ["stock-transfers", tenant, params],
    queryFn: () => listTransfers(params),
  });
}

export function useTransfer(id: string | undefined) {
  return useQuery({
    queryKey: ["stock-transfer", id],
    queryFn: () => getTransfer(id!),
    enabled: !!id,
  });
}

/**
 * Transfer transitions move stock in two branches at once, so they
 * invalidate stock levels alongside the transfer itself.
 */
function useTransferMutation<TArgs extends unknown[], TResult>(
  mutationFn: (...args: TArgs) => Promise<TResult>,
  id?: string,
) {
  const queryClient = useQueryClient();
  const tenant = useTenantKey();

  return useMutation({
    mutationFn: (variables: TArgs) => mutationFn(...variables),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stock-transfers", tenant] });
      if (id) queryClient.invalidateQueries({ queryKey: ["stock-transfer", id] });
      queryClient.invalidateQueries({ queryKey: ["stock", tenant] });
      queryClient.invalidateQueries({ queryKey: ["stock-moves", tenant] });
    },
    onError: (error) => toast.mutationError(error),
  });
}

export function useCreateTransfer() {
  return useTransferMutation<[TransferPayload], unknown>(createTransfer);
}

export function useDispatchTransfer(id?: string) {
  return useTransferMutation<[string], unknown>(dispatchTransfer, id);
}

export function useReceiveTransfer(id?: string) {
  return useTransferMutation<
    [string, { items?: Array<{ id: string; received_quantity: string }> }],
    unknown
  >(receiveTransfer, id);
}

export function useCancelTransfer(id?: string) {
  return useTransferMutation<[string], unknown>(cancelTransfer, id);
}

// --- Counts -----------------------------------------------------------------

export function useCounts(params: { status?: string; branch_id?: string } = {}) {
  const tenant = useTenantKey();

  return useQuery({
    queryKey: ["stock-counts", tenant, params],
    queryFn: () => listCounts(params),
  });
}

export function useCount(id: string | undefined) {
  return useQuery({
    queryKey: ["stock-count", id],
    queryFn: () => getCount(id!),
    enabled: !!id,
  });
}

function useCountMutation<TArgs extends unknown[], TResult>(
  mutationFn: (...args: TArgs) => Promise<TResult>,
  id?: string,
) {
  const queryClient = useQueryClient();
  const tenant = useTenantKey();

  return useMutation({
    mutationFn: (variables: TArgs) => mutationFn(...variables),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stock-counts", tenant] });
      if (id) queryClient.invalidateQueries({ queryKey: ["stock-count", id] });
      // Only approval writes stock, but invalidating here too costs one
      // refetch and removes a whole class of "the number didn't update" bug.
      queryClient.invalidateQueries({ queryKey: ["stock", tenant] });
    },
    onError: (error) => toast.mutationError(error),
  });
}

export function useCreateCount() {
  return useCountMutation<[CountPayload], unknown>(createCount);
}

export function useRecordCountItem(countId?: string) {
  return useCountMutation<
    [string, string, { counted_quantity: string; reason?: string; note?: string }],
    unknown
  >(recordCountItem, countId);
}

export function useSubmitCount(id?: string) {
  return useCountMutation<[string], unknown>(submitCount, id);
}

export function useApproveCount(id?: string) {
  return useCountMutation<[string], unknown>(approveCount, id);
}

export function useCancelCount(id?: string) {
  return useCountMutation<[string], unknown>(cancelCount, id);
}
