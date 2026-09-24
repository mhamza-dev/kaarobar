import { apiClient } from "@/lib/api/client";
import type { ApiEnvelope } from "@/types/api/common";
import type { Quote, QuoteLineInput, QuotePayload, WinRate } from "@/types/api/quotes";

async function get<T>(path: string, params?: object): Promise<T> {
  const response = await apiClient.get<ApiEnvelope<T>>(path, { params });
  return response.data.data;
}

async function post<T>(path: string, body: object = {}): Promise<T> {
  const response = await apiClient.post<ApiEnvelope<T>>(path, body);
  return response.data.data;
}

export const listQuotes = (params: { status?: string; customer_id?: string } = {}) =>
  get<Quote[]>("/quotes", params);

export const getQuote = (id: string) => get<Quote>(`/quotes/${id}`);

/** Totals come back computed from the lines — a client-sent total is never trusted. */
export const createQuote = (payload: QuotePayload) => post<Quote>("/quotes", payload);

/** Draft quotes only: replaces every line and reprices. */
export async function setQuoteLines(id: string, lines: QuoteLineInput[]): Promise<Quote> {
  const response = await apiClient.put<ApiEnvelope<Quote>>(`/quotes/${id}/lines`, { lines });
  return response.data.data;
}

export const sendQuote = (id: string) => post<Quote>(`/quotes/${id}/send`);

/** Accepting opens a service job from the lines, to record the work against. */
export const acceptQuote = (id: string) => post<Quote>(`/quotes/${id}/accept`);

export const declineQuote = (id: string, reason?: string) =>
  post<Quote>(`/quotes/${id}/decline`, { reason });

export const getWinRate = (from: string, to: string) =>
  get<WinRate>("/quotes/win-rate", { from, to });
