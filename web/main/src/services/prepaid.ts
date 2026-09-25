import { apiClient } from "@/lib/api/client";
import type { ApiEnvelope } from "@/types/api/common";
import type {
  GiftCard,
  GiftCardHistory,
  GiftCardPayload,
  GiftCardTransaction,
  IssuedGiftCard,
  StoreCredit,
  StoreCreditHistory,
  StoreCreditPayload,
  StoreCreditTransaction,
} from "@/types/api/crm";

const get = async <T>(url: string) => (await apiClient.get<ApiEnvelope<T>>(url)).data.data;
const post = async <T>(url: string, body: unknown = {}) =>
  (await apiClient.post<ApiEnvelope<T>>(url, body)).data.data;

// Card codes go in the path; encode them so a stray character can't change it.
const card = (code: string) => `/gift-cards/${encodeURIComponent(code.trim())}`;

// --- Gift cards -----------------------------------------------------------------

/** The only call that returns the plaintext code — show it now or lose it. */
export const issueGiftCard = (payload: GiftCardPayload) =>
  post<IssuedGiftCard>("/gift-cards", payload);

export const getGiftCard = (code: string) => get<GiftCard>(card(code));

export const getGiftCardHistory = (code: string) => get<GiftCardHistory>(`${card(code)}/history`);

export const activateGiftCard = (code: string) => post<GiftCard>(`${card(code)}/activate`);

export const topUpGiftCard = (code: string, amount: string, note?: string) =>
  post<GiftCardTransaction>(`${card(code)}/top-up`, { amount, note });

export const redeemGiftCard = (code: string, amount: string, note?: string) =>
  post<GiftCardTransaction>(`${card(code)}/redeem`, { amount, note });

// --- Store credit -----------------------------------------------------------------

export const issueStoreCredit = (customerId: string, payload: StoreCreditPayload) =>
  post<StoreCredit>(`/customers/${customerId}/store-credit`, payload);

export const getStoreCreditHistory = (id: string) =>
  get<StoreCreditHistory>(`/store-credit/${id}/history`);

export const redeemStoreCredit = (id: string, amount: string, note?: string) =>
  post<StoreCreditTransaction>(`/store-credit/${id}/redeem`, { amount, note });
