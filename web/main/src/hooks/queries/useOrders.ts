import { useQuery } from "@tanstack/react-query";

import { cancelOrder, listOrders, parkBasket, resumeOrder } from "@/services/orders";
import type { OrderItemInput } from "@/types/api/orders";

import { useTenantKey } from "./keys";
import { useInvalidatingMutation } from "./mutations";

const ORDER_KEYS = ["orders", "order", "floor-plan"];

export function useHeldOrders(enabled = true) {
  const tenant = useTenantKey();
  return useQuery({
    queryKey: ["orders", tenant, "held"],
    queryFn: () => listOrders({ status: "held" }),
    enabled,
  });
}

export const useParkBasket = () =>
  useInvalidatingMutation<
    [
      {
        branch_id: string;
        register_id: string;
        customer_id?: string | null;
        label?: string | null;
        items: OrderItemInput[];
      },
    ],
    unknown
  >(parkBasket, ORDER_KEYS);
export const useResumeOrder = () =>
  useInvalidatingMutation<[string], unknown>(resumeOrder, ORDER_KEYS);
export const useCancelOrder = () =>
  useInvalidatingMutation<[string, string?], unknown>(cancelOrder, ORDER_KEYS);
