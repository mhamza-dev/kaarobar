import { apiClient } from "@/lib/api/client";
import type { ApiEnvelope, CursorParams, Paginated } from "@/types/api/common";
import type {
  CreditAgeing,
  CreditInvoice,
  Customer,
  CustomerAddress,
  CustomerAgeing,
  CustomerContact,
  CustomerGroup,
  CustomerLedger,
  CustomerListParams,
  CustomerNote,
  CustomerPayload,
  CustomerPayment,
  CustomerStatement,
  FollowUp,
  FollowUpUpdate,
  LoyaltyAccount,
  LoyaltyProgram,
  LoyaltyTransaction,
  PaymentAllocation,
  StoreCredit,
} from "@/types/api/crm";

/** `GET /customers` — cursor-paginated; `q`, `owing` and `credit_allowed` filter server-side. */
export async function listCustomers(
  params: CustomerListParams & CursorParams,
): Promise<Paginated<Customer>> {
  const response = await apiClient.get<Paginated<Customer>>("/customers", { params });
  return response.data;
}

export async function getCustomer(id: string): Promise<Customer> {
  const response = await apiClient.get<ApiEnvelope<Customer>>(`/customers/${id}`);
  return response.data.data;
}

/**
 * `GET /customers/lookup/:phone` — the till's lookup.
 *
 * A phone number is how a shop identifies a returning customer, so this is
 * the path the POS customer picker uses rather than a full search.
 */
export async function lookupCustomerByPhone(phone: string): Promise<Customer> {
  const response = await apiClient.get<ApiEnvelope<Customer>>(
    `/customers/lookup/${encodeURIComponent(phone)}`,
  );
  return response.data.data;
}

export async function createCustomer(payload: CustomerPayload): Promise<Customer> {
  const response = await apiClient.post<ApiEnvelope<Customer>>("/customers", payload);
  return response.data.data;
}

export async function updateCustomer(
  id: string,
  payload: Partial<CustomerPayload>,
): Promise<Customer> {
  const response = await apiClient.patch<ApiEnvelope<Customer>>(`/customers/${id}`, payload);
  return response.data.data;
}

export async function archiveCustomer(id: string): Promise<void> {
  await apiClient.delete(`/customers/${id}`);
}

/** The account: every entry that moved this customer's balance, oldest first. */
export async function getCustomerLedger(id: string): Promise<CustomerLedger> {
  const response = await apiClient.get<ApiEnvelope<CustomerLedger>>(`/customers/${id}/ledger`);
  return response.data.data;
}

export async function listCustomerPayments(id: string): Promise<CustomerPayment[]> {
  const response = await apiClient.get<ApiEnvelope<CustomerPayment[]>>(`/customers/${id}/payments`);
  return response.data.data;
}

export type RecordCustomerPaymentPayload = {
  amount: string;
  method: string;
  paid_on?: string;
  reference?: string;
  notes?: string;
  /** `sale_id → amount` — settles specific invoices. */
  allocations?: Record<string, string>;
  /** Spreads the payment over the oldest open invoices instead. */
  auto_allocate?: boolean;
};

/**
 * Recording a payment against a balance.
 *
 * With neither `allocations` nor `auto_allocate` the backend leaves the money
 * on account, which is the right default when a customer pays a round sum
 * against several bills and nobody has decided which ones yet.
 */
export async function recordCustomerPayment(
  id: string,
  payload: RecordCustomerPaymentPayload,
): Promise<CustomerPayment> {
  const response = await apiClient.post<ApiEnvelope<CustomerPayment>>(
    `/customers/${id}/payments`,
    payload,
  );
  return response.data.data;
}

export async function listCustomerAddresses(customerId: string): Promise<CustomerAddress[]> {
  const response = await apiClient.get<ApiEnvelope<CustomerAddress[]>>(
    `/customers/${customerId}/addresses`,
  );
  return response.data.data;
}

export async function addCustomerAddress(
  customerId: string,
  payload: Partial<CustomerAddress>,
): Promise<CustomerAddress> {
  const response = await apiClient.post<ApiEnvelope<CustomerAddress>>(
    `/customers/${customerId}/addresses`,
    payload,
  );
  return response.data.data;
}

export async function updateCustomerAddress(
  id: string,
  payload: Partial<CustomerAddress>,
): Promise<CustomerAddress> {
  const response = await apiClient.patch<ApiEnvelope<CustomerAddress>>(
    `/customer-addresses/${id}`,
    payload,
  );
  return response.data.data;
}

export async function deleteCustomerAddress(id: string): Promise<void> {
  await apiClient.delete(`/customer-addresses/${id}`);
}

export async function listCustomerContacts(customerId: string): Promise<CustomerContact[]> {
  const response = await apiClient.get<ApiEnvelope<CustomerContact[]>>(
    `/customers/${customerId}/contacts`,
  );
  return response.data.data;
}

export async function addCustomerContact(
  customerId: string,
  payload: Partial<CustomerContact>,
): Promise<CustomerContact> {
  const response = await apiClient.post<ApiEnvelope<CustomerContact>>(
    `/customers/${customerId}/contacts`,
    payload,
  );
  return response.data.data;
}

export async function deleteCustomerContact(id: string): Promise<void> {
  await apiClient.delete(`/customer-contacts/${id}`);
}

export async function listCustomerNotes(customerId: string): Promise<CustomerNote[]> {
  const response = await apiClient.get<ApiEnvelope<CustomerNote[]>>(
    `/customers/${customerId}/notes`,
  );
  return response.data.data;
}

export async function addCustomerNote(
  customerId: string,
  payload: { body: string; is_pinned?: boolean },
): Promise<CustomerNote> {
  const response = await apiClient.post<ApiEnvelope<CustomerNote>>(
    `/customers/${customerId}/notes`,
    payload,
  );
  return response.data.data;
}

export async function deleteCustomerNote(id: string): Promise<void> {
  await apiClient.delete(`/customer-notes/${id}`);
}

// --- Groups -----------------------------------------------------------------

export async function listCustomerGroups(): Promise<CustomerGroup[]> {
  const response = await apiClient.get<ApiEnvelope<CustomerGroup[]>>("/customer-groups");
  return response.data.data;
}

export async function createCustomerGroup(payload: Partial<CustomerGroup>): Promise<CustomerGroup> {
  const response = await apiClient.post<ApiEnvelope<CustomerGroup>>("/customer-groups", payload);
  return response.data.data;
}

export async function updateCustomerGroup(
  id: string,
  payload: Partial<CustomerGroup>,
): Promise<CustomerGroup> {
  const response = await apiClient.patch<ApiEnvelope<CustomerGroup>>(
    `/customer-groups/${id}`,
    payload,
  );
  return response.data.data;
}

export async function deleteCustomerGroup(id: string): Promise<void> {
  await apiClient.delete(`/customer-groups/${id}`);
}

// --- Credit -----------------------------------------------------------------

export async function getCreditAgeing(params: { as_of?: string } = {}): Promise<CreditAgeing> {
  const response = await apiClient.get<ApiEnvelope<CreditAgeing>>("/credit/ageing", { params });
  return response.data.data;
}

/** Unpaid credit sales, oldest first — optionally one customer's. */
export async function listOpenInvoices(
  params: { customer_id?: string } = {},
): Promise<CreditInvoice[]> {
  const response = await apiClient.get<ApiEnvelope<CreditInvoice[]>>("/credit/invoices", {
    params,
  });
  return response.data.data;
}

/** Ageing broken down per customer — who to chase, and how overdue they are. */
export async function getAgeingByCustomer(
  params: { as_of?: string } = {},
): Promise<CustomerAgeing[]> {
  const response = await apiClient.get<ApiEnvelope<CustomerAgeing[]>>(
    "/credit/ageing/by-customer",
    { params },
  );
  return response.data.data;
}

export async function getCustomerStatement(customerId: string): Promise<CustomerStatement> {
  const response = await apiClient.get<ApiEnvelope<CustomerStatement>>(
    `/credit/statement/${customerId}`,
  );
  return response.data.data;
}

// --- Follow-ups ---------------------------------------------------------------

export async function listFollowUps(
  params: { status?: string; customer_id?: string; due_before?: string } = {},
): Promise<FollowUp[]> {
  const response = await apiClient.get<ApiEnvelope<FollowUp[]>>("/follow-ups", { params });
  return response.data.data;
}

export async function createFollowUp(
  customerId: string,
  payload: { title: string; kind?: string; due_on: string; body?: string },
): Promise<FollowUp> {
  const response = await apiClient.post<ApiEnvelope<FollowUp>>(
    `/customers/${customerId}/follow-ups`,
    payload,
  );
  return response.data.data;
}

/** The outcome is required — "done" with nothing said helps nobody who rings next. */
export async function getFollowUp(id: string): Promise<FollowUp> {
  const response = await apiClient.get<ApiEnvelope<FollowUp>>(`/follow-ups/${id}`);
  return response.data.data;
}

export async function updateFollowUp(id: string, payload: FollowUpUpdate): Promise<FollowUp> {
  const response = await apiClient.patch<ApiEnvelope<FollowUp>>(`/follow-ups/${id}`, payload);
  return response.data.data;
}

/**
 * Applies a payment on account to particular invoices — `allocations` maps
 * sale ids to amounts — or, with `auto`, to the oldest first.
 */
export async function allocateCustomerPayment(
  paymentId: string,
  payload: { allocations: Record<string, string> } | { auto: true },
): Promise<PaymentAllocation[]> {
  const response = await apiClient.post<ApiEnvelope<PaymentAllocation[]>>(
    `/credit/payments/${paymentId}/allocate`,
    payload,
  );
  return response.data.data;
}

export async function completeFollowUp(id: string, outcome: string): Promise<FollowUp> {
  const response = await apiClient.post<ApiEnvelope<FollowUp>>(`/follow-ups/${id}/complete`, {
    outcome,
  });
  return response.data.data;
}

export async function cancelFollowUp(id: string, reason?: string): Promise<FollowUp> {
  const response = await apiClient.post<ApiEnvelope<FollowUp>>(`/follow-ups/${id}/cancel`, {
    reason,
  });
  return response.data.data;
}

// --- Loyalty ------------------------------------------------------------------

/** The business's active programme — 404 (`ApiError` status 404) when it has none. */
export async function getLoyaltyProgram(): Promise<LoyaltyProgram> {
  const response = await apiClient.get<ApiEnvelope<LoyaltyProgram>>("/loyalty/program");
  return response.data.data;
}

export async function createLoyaltyProgram(
  payload: Partial<LoyaltyProgram>,
): Promise<LoyaltyProgram> {
  const response = await apiClient.post<ApiEnvelope<LoyaltyProgram>>("/loyalty/program", payload);
  return response.data.data;
}

export async function updateLoyaltyProgram(
  payload: Partial<LoyaltyProgram>,
): Promise<LoyaltyProgram> {
  const response = await apiClient.patch<ApiEnvelope<LoyaltyProgram>>("/loyalty/program", payload);
  return response.data.data;
}

/** A customer's points and history — 404 when they have never earned. */
export async function getLoyaltyHistory(
  customerId: string,
): Promise<{ account: LoyaltyAccount; transactions: LoyaltyTransaction[] }> {
  const response = await apiClient.get<
    ApiEnvelope<{ account: LoyaltyAccount; transactions: LoyaltyTransaction[] }>
  >(`/loyalty/customers/${customerId}/transactions`);
  return response.data.data;
}

/** A manual correction — `points` is signed; the reason is kept on the ledger. */
export async function adjustLoyaltyPoints(
  customerId: string,
  payload: { points: number; reason: string },
): Promise<LoyaltyTransaction> {
  const response = await apiClient.post<ApiEnvelope<LoyaltyTransaction>>(
    `/loyalty/customers/${customerId}/adjust`,
    payload,
  );
  return response.data.data;
}

// --- Store credit ---------------------------------------------------------------

/** Spendable store credit, with the total in `meta.balance`. */
export async function listStoreCredit(
  customerId: string,
): Promise<{ credits: StoreCredit[]; balance: string | null }> {
  const response = await apiClient.get<{ data: StoreCredit[]; meta: { balance: string | null } }>(
    `/customers/${customerId}/store-credit`,
  );
  return { credits: response.data.data, balance: response.data.meta.balance };
}
