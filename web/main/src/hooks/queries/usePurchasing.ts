import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { toast } from "@/hooks/useToast";
import { flattenPages, getNextCursorParam } from "@/lib/api/pagination";
import {
  approvePurchaseOrder,
  archiveSupplier,
  cancelPurchaseOrder,
  closePurchaseOrder,
  createGoodsReceipt,
  createPurchaseOrder,
  createSupplier,
  getGoodsReceipt,
  getPayablesAgeing,
  getPurchaseOrder,
  listGoodsReceipts,
  listPurchaseOrders,
  listPurchaseReturns,
  listSupplierBills,
  listSuppliers,
  postGoodsReceipt,
  postPurchaseReturn,
  postSupplierBill,
  updatePurchaseOrder,
  updateSupplier,
} from "@/services/purchasing";
import type {
  GoodsReceiptPayload,
  PurchaseOrderPayload,
  SupplierPayload,
} from "@/types/api/purchasing";

import { useTenantKey } from "./keys";

// --- Suppliers --------------------------------------------------------------

export function useSuppliers(params: { q?: string; active?: boolean; owing?: boolean } = {}) {
  const tenant = useTenantKey();

  return useQuery({
    queryKey: ["suppliers", tenant, params],
    queryFn: () => listSuppliers(params),
  });
}

function useSupplierMutation<TArgs extends unknown[], TResult>(
  mutationFn: (...args: TArgs) => Promise<TResult>,
) {
  const queryClient = useQueryClient();
  const tenant = useTenantKey();

  return useMutation({
    mutationFn: (variables: TArgs) => mutationFn(...variables),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["suppliers", tenant] }),
    onError: (error) => toast.mutationError(error),
  });
}

export function useCreateSupplier() {
  return useSupplierMutation<[SupplierPayload], unknown>(createSupplier);
}

export function useUpdateSupplier() {
  return useSupplierMutation<[string, Partial<SupplierPayload>], unknown>(updateSupplier);
}

export function useArchiveSupplier() {
  return useSupplierMutation<[string], unknown>(archiveSupplier);
}

// --- Purchase orders --------------------------------------------------------

export function usePurchaseOrders(
  params: { status?: string; supplier_id?: string; open?: boolean } = {},
) {
  const tenant = useTenantKey();

  const query = useInfiniteQuery({
    queryKey: ["purchase-orders", tenant, params],
    queryFn: ({ pageParam }) => listPurchaseOrders({ ...params, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: getNextCursorParam,
  });

  return { ...query, rows: flattenPages(query.data?.pages) };
}

export function usePurchaseOrder(id: string | undefined) {
  return useQuery({
    queryKey: ["purchase-order", id],
    queryFn: () => getPurchaseOrder(id!),
    enabled: !!id,
  });
}

/**
 * A PO transition can change stock (receiving), the supplier balance
 * (billing) and the order itself, so the whole purchasing surface is
 * invalidated together rather than guessing which of them moved.
 */
function usePurchasingMutation<TArgs extends unknown[], TResult>(
  mutationFn: (...args: TArgs) => Promise<TResult>,
  id?: string,
) {
  const queryClient = useQueryClient();
  const tenant = useTenantKey();

  return useMutation({
    mutationFn: (variables: TArgs) => mutationFn(...variables),
    onSuccess: () => {
      for (const key of [
        "purchase-orders",
        "goods-receipts",
        "supplier-bills",
        "purchase-returns",
        "suppliers",
        "stock",
        "stock-moves",
      ]) {
        queryClient.invalidateQueries({ queryKey: [key, tenant] });
      }
      if (id) queryClient.invalidateQueries({ queryKey: ["purchase-order", id] });
    },
    onError: (error) => toast.mutationError(error),
  });
}

export function useCreatePurchaseOrder() {
  return usePurchasingMutation<[PurchaseOrderPayload], unknown>(createPurchaseOrder);
}

export function useUpdatePurchaseOrder(id?: string) {
  return usePurchasingMutation<[string, Partial<PurchaseOrderPayload>], unknown>(
    updatePurchaseOrder,
    id,
  );
}

export function useApprovePurchaseOrder(id?: string) {
  return usePurchasingMutation<[string], unknown>(approvePurchaseOrder, id);
}

export function useCancelPurchaseOrder(id?: string) {
  return usePurchasingMutation<[string], unknown>(cancelPurchaseOrder, id);
}

export function useClosePurchaseOrder(id?: string) {
  return usePurchasingMutation<[string], unknown>(closePurchaseOrder, id);
}

// --- Goods receipts, bills, returns -----------------------------------------

export function useGoodsReceipts(
  params: { status?: string; supplier_id?: string; purchase_order_id?: string } = {},
) {
  const tenant = useTenantKey();

  return useQuery({
    queryKey: ["goods-receipts", tenant, params],
    queryFn: () => listGoodsReceipts(params),
  });
}

export function useGoodsReceipt(id: string | undefined) {
  return useQuery({
    queryKey: ["goods-receipt", id],
    queryFn: () => getGoodsReceipt(id!),
    enabled: !!id,
  });
}

export function useCreateGoodsReceipt() {
  return usePurchasingMutation<[GoodsReceiptPayload], unknown>(createGoodsReceipt);
}

export function usePostGoodsReceipt() {
  return usePurchasingMutation<[string], unknown>(postGoodsReceipt);
}

export function useSupplierBills(
  params: { status?: string; supplier_id?: string; outstanding?: boolean; overdue?: boolean } = {},
) {
  const tenant = useTenantKey();

  return useQuery({
    queryKey: ["supplier-bills", tenant, params],
    queryFn: () => listSupplierBills(params),
  });
}

export function usePostSupplierBill() {
  return usePurchasingMutation<[string], unknown>(postSupplierBill);
}

export function usePayablesAgeing() {
  const tenant = useTenantKey();

  return useQuery({
    queryKey: ["payables-ageing", tenant],
    queryFn: getPayablesAgeing,
  });
}

export function usePurchaseReturns(params: { status?: string; supplier_id?: string } = {}) {
  const tenant = useTenantKey();

  return useQuery({
    queryKey: ["purchase-returns", tenant, params],
    queryFn: () => listPurchaseReturns(params),
  });
}

export function usePostPurchaseReturn() {
  return usePurchasingMutation<[string], unknown>(postPurchaseReturn);
}
