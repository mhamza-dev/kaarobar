import { apiClient } from "@/lib/api/client";
import type { ApiEnvelope, CursorParams, Paginated } from "@/types/api/common";
import type {
  GoodsReceipt,
  GoodsReceiptPayload,
  PayablesAgeing,
  PurchaseOrder,
  PurchaseOrderPayload,
  PurchaseReturn,
  Supplier,
  SupplierBill,
  SupplierPayload,
} from "@/types/api/purchasing";

// --- Suppliers --------------------------------------------------------------

/** `GET /suppliers` — a plain array; `owing` narrows to those with a balance. */
export async function listSuppliers(
  params: { q?: string; active?: boolean; owing?: boolean } = {},
): Promise<Supplier[]> {
  const response = await apiClient.get<ApiEnvelope<Supplier[]>>("/suppliers", { params });
  return response.data.data;
}

export async function getSupplier(id: string): Promise<Supplier> {
  const response = await apiClient.get<ApiEnvelope<Supplier>>(`/suppliers/${id}`);
  return response.data.data;
}

export async function createSupplier(payload: SupplierPayload): Promise<Supplier> {
  const response = await apiClient.post<ApiEnvelope<Supplier>>("/suppliers", payload);
  return response.data.data;
}

export async function updateSupplier(
  id: string,
  payload: Partial<SupplierPayload>,
): Promise<Supplier> {
  const response = await apiClient.patch<ApiEnvelope<Supplier>>(`/suppliers/${id}`, payload);
  return response.data.data;
}

/** Archives rather than deletes — purchase history still points at them. */
export async function archiveSupplier(id: string): Promise<void> {
  await apiClient.delete(`/suppliers/${id}`);
}

// --- Purchase orders --------------------------------------------------------

/** `GET /purchase-orders` — cursor-paginated. */
export async function listPurchaseOrders(
  params: {
    status?: string;
    supplier_id?: string;
    branch_id?: string;
    open?: boolean;
  } & CursorParams,
): Promise<Paginated<PurchaseOrder>> {
  const response = await apiClient.get<Paginated<PurchaseOrder>>("/purchase-orders", { params });
  return response.data;
}

export async function getPurchaseOrder(id: string): Promise<PurchaseOrder> {
  const response = await apiClient.get<ApiEnvelope<PurchaseOrder>>(`/purchase-orders/${id}`);
  return response.data.data;
}

export async function createPurchaseOrder(payload: PurchaseOrderPayload): Promise<PurchaseOrder> {
  const response = await apiClient.post<ApiEnvelope<PurchaseOrder>>("/purchase-orders", payload);
  return response.data.data;
}

export async function updatePurchaseOrder(
  id: string,
  payload: Partial<PurchaseOrderPayload>,
): Promise<PurchaseOrder> {
  const response = await apiClient.patch<ApiEnvelope<PurchaseOrder>>(
    `/purchase-orders/${id}`,
    payload,
  );
  return response.data.data;
}

/** The PO lifecycle. Each transition is its own permission. */
export async function approvePurchaseOrder(id: string): Promise<PurchaseOrder> {
  const response = await apiClient.post<ApiEnvelope<PurchaseOrder>>(
    `/purchase-orders/${id}/approve`,
    {},
  );
  return response.data.data;
}

export async function cancelPurchaseOrder(id: string): Promise<PurchaseOrder> {
  const response = await apiClient.post<ApiEnvelope<PurchaseOrder>>(
    `/purchase-orders/${id}/cancel`,
    {},
  );
  return response.data.data;
}

export async function closePurchaseOrder(id: string): Promise<PurchaseOrder> {
  const response = await apiClient.post<ApiEnvelope<PurchaseOrder>>(
    `/purchase-orders/${id}/close`,
    {},
  );
  return response.data.data;
}

// --- Goods receipts ---------------------------------------------------------

export async function listGoodsReceipts(
  params: { status?: string; supplier_id?: string; purchase_order_id?: string } = {},
): Promise<GoodsReceipt[]> {
  const response = await apiClient.get<ApiEnvelope<GoodsReceipt[]>>("/goods-receipts", {
    params,
  });
  return response.data.data;
}

export async function getGoodsReceipt(id: string): Promise<GoodsReceipt> {
  const response = await apiClient.get<ApiEnvelope<GoodsReceipt>>(`/goods-receipts/${id}`);
  return response.data.data;
}

export async function createGoodsReceipt(payload: GoodsReceiptPayload): Promise<GoodsReceipt> {
  const response = await apiClient.post<ApiEnvelope<GoodsReceipt>>("/goods-receipts", payload);
  return response.data.data;
}

/** Posting is what moves the goods into stock — until then nothing has arrived. */
export async function postGoodsReceipt(id: string): Promise<GoodsReceipt> {
  const response = await apiClient.post<ApiEnvelope<GoodsReceipt>>(
    `/goods-receipts/${id}/post`,
    {},
  );
  return response.data.data;
}

// --- Bills, payments, returns -----------------------------------------------

export async function listSupplierBills(
  params: {
    status?: string;
    supplier_id?: string;
    outstanding?: boolean;
    overdue?: boolean;
  } = {},
): Promise<SupplierBill[]> {
  const response = await apiClient.get<ApiEnvelope<SupplierBill[]>>("/supplier-bills", {
    params,
  });
  return response.data.data;
}

export async function getSupplierBill(id: string): Promise<SupplierBill> {
  const response = await apiClient.get<ApiEnvelope<SupplierBill>>(`/supplier-bills/${id}`);
  return response.data.data;
}

export async function postSupplierBill(id: string): Promise<SupplierBill> {
  const response = await apiClient.post<ApiEnvelope<SupplierBill>>(
    `/supplier-bills/${id}/post`,
    {},
  );
  return response.data.data;
}

export async function getPayablesAgeing(): Promise<PayablesAgeing> {
  const response = await apiClient.get<ApiEnvelope<PayablesAgeing>>("/supplier-bills/ageing");
  return response.data.data;
}

export async function recordSupplierPayment(payload: {
  supplier_id: string;
  amount: string;
  method: string;
  paid_on?: string;
  reference?: string;
  allocations?: Array<{ supplier_bill_id: string; amount: string }>;
}): Promise<unknown> {
  const response = await apiClient.post<ApiEnvelope<unknown>>("/supplier-payments", payload);
  return response.data.data;
}

export async function listPurchaseReturns(
  params: { status?: string; supplier_id?: string } = {},
): Promise<PurchaseReturn[]> {
  const response = await apiClient.get<ApiEnvelope<PurchaseReturn[]>>("/purchase-returns", {
    params,
  });
  return response.data.data;
}

export async function postPurchaseReturn(id: string): Promise<PurchaseReturn> {
  const response = await apiClient.post<ApiEnvelope<PurchaseReturn>>(
    `/purchase-returns/${id}/post`,
    {},
  );
  return response.data.data;
}
