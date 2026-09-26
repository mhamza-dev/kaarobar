import { apiClient } from "@/lib/api/client";
import type { ApiEnvelope } from "@/types/api/common";
import type { Order, OrderItemInput } from "@/types/api/orders";

const post = async <T>(url: string, body: unknown = {}) =>
  (await apiClient.post<ApiEnvelope<T>>(url, body)).data.data;

export const listOrders = async (params: { status?: string } = {}) =>
  (await apiClient.get<ApiEnvelope<Order[]>>("/orders", { params })).data.data;

export const createOrder = (payload: {
  branch_id: string;
  register_id?: string | null;
  customer_id?: string | null;
  channel?: string;
  label?: string | null;
}) => post<Order>("/orders", payload);

/** A ticket set aside — a customer who went back for something they forgot. */
export const holdOrder = (id: string) => post<Order>(`/orders/${id}/hold`);
export const resumeOrder = (id: string) => post<Order>(`/orders/${id}/resume`);
export const cancelOrder = (id: string, reason?: string) =>
  post<Order>(`/orders/${id}/cancel`, { reason });

/**
 * Parks a basket: the lines become an order, which is then held. Three
 * calls; if a later one fails the order stays open, which is still a
 * ticket someone can find and settle.
 */
export async function parkBasket(payload: {
  branch_id: string;
  register_id: string;
  customer_id?: string | null;
  label?: string | null;
  items: OrderItemInput[];
}): Promise<Order> {
  const order = await createOrder({
    branch_id: payload.branch_id,
    register_id: payload.register_id,
    customer_id: payload.customer_id ?? null,
    channel: "pos",
    label: payload.label ?? null,
  });
  await post<Order>(`/orders/${order.id}/items`, { items: payload.items });
  return holdOrder(order.id);
}
