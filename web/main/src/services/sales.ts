import { apiClient } from "@/lib/api/client";
import type { ApiEnvelope, CursorParams, Paginated } from "@/types/api/common";
import type { ProductVariant } from "@/types/api/catalog";
import type {
  CheckoutPayload,
  RefundRequest,
  RefundRequestPayload,
  ReturnLine,
  Sale,
  SaleQuote,
  SaleReturn,
  SaleSummary,
} from "@/types/api/sales";

/**
 * `POST /sales/quote` — prices a basket without selling it.
 *
 * The only way the till learns what anything costs. `Kaarobar.Sales.Checkout`
 * applies the catalog price, price lists, promotions and tax; the client
 * sends quantities. Anything the UI displayed from its own arithmetic would
 * be a number the receipt then contradicts.
 */
export async function quoteSale(
  payload: Pick<CheckoutPayload, "lines" | "customer_id" | "order_discount" | "branch_id">,
): Promise<SaleQuote> {
  const response = await apiClient.post<ApiEnvelope<SaleQuote>>("/sales/quote", payload);
  return response.data.data;
}

/**
 * `POST /sales` — the checkout itself.
 *
 * One transaction on the backend: stock, sale, tenders, credit ledger and
 * shift totals all land or none do. The axios interceptor attaches an
 * `Idempotency-Key`, so a retry after a dropped connection cannot charge the
 * customer twice.
 */
export async function createSale(payload: CheckoutPayload): Promise<Sale> {
  const response = await apiClient.post<ApiEnvelope<Sale>>("/sales", payload);
  return response.data.data;
}

export async function listSales(
  params: CursorParams & { status?: string } = {},
): Promise<Paginated<SaleSummary>> {
  const response = await apiClient.get<Paginated<SaleSummary>>("/sales", { params });
  return response.data;
}

export async function getSale(id: string): Promise<Sale> {
  const response = await apiClient.get<ApiEnvelope<Sale>>(`/sales/${id}`);
  return response.data.data;
}

/** Looking a receipt up by the number printed on it. */
export async function getSaleByNumber(number: string): Promise<Sale> {
  const response = await apiClient.get<ApiEnvelope<Sale>>(
    `/sales/by-number/${encodeURIComponent(number)}`,
  );
  return response.data.data;
}

/** Voiding reverses the whole sale; refunding returns part of it. */
export async function voidSale(id: string, reason: string): Promise<Sale> {
  const response = await apiClient.post<ApiEnvelope<Sale>>(`/sales/${id}/void`, { reason });
  return response.data.data;
}

/**
 * Processes a return: takes the goods back (restocking, or writing off what
 * is faulty) and pays the money back across the original tenders. Paid
 * against an approved refund request.
 */
export async function refundSale(
  id: string,
  payload: { items: ReturnLine[]; refund_request_id?: string; reason?: string },
): Promise<SaleReturn> {
  const response = await apiClient.post<ApiEnvelope<SaleReturn>>(`/sales/${id}/refund`, payload);
  return response.data.data;
}

export async function createRefundRequest(
  saleId: string,
  payload: RefundRequestPayload,
): Promise<RefundRequest> {
  const response = await apiClient.post<ApiEnvelope<RefundRequest>>(
    `/sales/${saleId}/refund-requests`,
    payload,
  );
  return response.data.data;
}

export async function getRefundRequest(id: string): Promise<RefundRequest> {
  const response = await apiClient.get<ApiEnvelope<RefundRequest>>(`/refund-requests/${id}`);
  return response.data.data;
}

export async function listSaleReturns(params: { sale_id?: string } = {}): Promise<SaleReturn[]> {
  const response = await apiClient.get<ApiEnvelope<SaleReturn[]>>("/sales/returns", { params });
  return response.data.data;
}

export async function listRefundRequests(
  params: { status?: string } = {},
): Promise<RefundRequest[]> {
  const response = await apiClient.get<ApiEnvelope<RefundRequest[]>>("/refund-requests", {
    params,
  });
  return response.data.data;
}

export async function approveRefundRequest(id: string, note?: string): Promise<RefundRequest> {
  const response = await apiClient.post<ApiEnvelope<RefundRequest>>(
    `/refund-requests/${id}/approve`,
    { note },
  );
  return response.data.data;
}

/** A note is required — the customer will ask why, and someone else may answer. */
export async function rejectRefundRequest(id: string, note: string): Promise<RefundRequest> {
  const response = await apiClient.post<ApiEnvelope<RefundRequest>>(
    `/refund-requests/${id}/reject`,
    { note },
  );
  return response.data.data;
}

/** `GET /products/scan/:barcode` — the scanner's lookup, returning a variant. */
export async function scanBarcode(barcode: string): Promise<ProductVariant> {
  const response = await apiClient.get<ApiEnvelope<ProductVariant>>(
    `/products/scan/${encodeURIComponent(barcode)}`,
  );
  return response.data.data;
}
