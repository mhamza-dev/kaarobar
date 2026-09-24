import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { toast } from "@/hooks/useToast";
import { flattenPages, getNextCursorParam } from "@/lib/api/pagination";
import {
  approveRefundRequest,
  createSale,
  getSale,
  listRefundRequests,
  listSales,
  quoteSale,
  refundSale,
  rejectRefundRequest,
  voidSale,
} from "@/services/sales";
import type { CheckoutLine, CheckoutPayload } from "@/types/api/sales";

import { useTenantKey } from "./keys";

export function useSalesList(params: { status?: string } = {}) {
  const tenant = useTenantKey();

  const query = useInfiniteQuery({
    queryKey: ["sales", tenant, params],
    queryFn: ({ pageParam }) => listSales({ ...params, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: getNextCursorParam,
  });

  return { ...query, rows: flattenPages(query.data?.pages) };
}

export function useSale(id: string | undefined) {
  return useQuery({
    queryKey: ["sale", id],
    queryFn: () => getSale(id!),
    enabled: !!id,
  });
}

/**
 * The priced basket.
 *
 * A query rather than a mutation even though it POSTs: it is a pure read of
 * "what would this cost", it is re-run whenever the basket changes, and
 * React Query's caching means an unchanged cart doesn't re-quote. `enabled`
 * keeps an empty cart from asking the backend to price nothing.
 *
 * The caller debounces the cart before passing it here, so adjusting a
 * quantity with the arrow keys doesn't fire a request per keystroke.
 */
export function useSaleQuote(
  lines: CheckoutLine[],
  options: { branchId?: string; customerId?: string; orderDiscount?: string } = {},
) {
  const tenant = useTenantKey();

  return useQuery({
    queryKey: [
      "sale-quote",
      tenant,
      lines,
      options.branchId,
      options.customerId,
      options.orderDiscount,
    ],
    queryFn: () =>
      quoteSale({
        lines,
        branch_id: options.branchId,
        customer_id: options.customerId,
        order_discount: options.orderDiscount,
      }),
    // Without a branch the backend refuses with `branch_required`, so don't
    // ask until the register (and therefore the branch) is known.
    enabled: lines.length > 0 && !!options.branchId,
    // A stale price is worse than a brief spinner at a till.
    staleTime: 0,
    retry: false,
  });
}

/**
 * Completing the sale.
 *
 * Invalidates stock and the shift as well as the sales list: a checkout
 * decrements stock and moves the drawer's totals in the same transaction,
 * so leaving either stale shows figures that contradict the receipt just
 * printed.
 */
export function useCreateSale() {
  const queryClient = useQueryClient();
  const tenant = useTenantKey();

  return useMutation({
    mutationFn: (payload: CheckoutPayload) => createSale(payload),
    onSuccess: () => {
      for (const key of ["sales", "stock", "stock-moves", "shifts"]) {
        queryClient.invalidateQueries({ queryKey: [key, tenant] });
      }
      queryClient.invalidateQueries({ queryKey: ["current-shift"] });
      // A sale on account moves the customer's balance and any sale with a
      // customer earns points, so their account screens are stale too.
      for (const key of ["customers", "customer", "credit", "loyalty"]) {
        queryClient.invalidateQueries({ queryKey: [key] });
      }
    },
    onError: (error) => toast.mutationError(error),
  });
}

function useSaleMutation<TArgs extends unknown[], TResult>(
  mutationFn: (...args: TArgs) => Promise<TResult>,
) {
  const queryClient = useQueryClient();
  const tenant = useTenantKey();

  return useMutation({
    mutationFn: (variables: TArgs) => mutationFn(...variables),
    onSuccess: () => {
      for (const key of ["sales", "stock", "refund-requests", "shifts"]) {
        queryClient.invalidateQueries({ queryKey: [key, tenant] });
      }
      queryClient.invalidateQueries({ queryKey: ["sale"] });
      // Voids and refunds reverse ledger entries and points.
      for (const key of ["customers", "customer", "credit", "loyalty"]) {
        queryClient.invalidateQueries({ queryKey: [key] });
      }
    },
    onError: (error) => toast.mutationError(error),
  });
}

export function useVoidSale() {
  return useSaleMutation<[string, string], unknown>(voidSale);
}

export function useRefundSale() {
  return useSaleMutation<
    [
      string,
      {
        items?: Array<{ sale_item_id: string; quantity: string }>;
        amount?: string;
        reason?: string;
      },
    ],
    unknown
  >(refundSale);
}

export function useRefundRequests(params: { status?: string } = {}) {
  const tenant = useTenantKey();

  return useQuery({
    queryKey: ["refund-requests", tenant, params],
    queryFn: () => listRefundRequests(params),
  });
}

export function useApproveRefundRequest() {
  return useSaleMutation<[string], unknown>(approveRefundRequest);
}

export function useRejectRefundRequest() {
  return useSaleMutation<[string, string | undefined], unknown>(rejectRefundRequest);
}
