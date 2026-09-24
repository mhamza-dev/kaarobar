import { useQuery } from "@tanstack/react-query";

import {
  acceptQuote,
  createQuote,
  declineQuote,
  getQuote,
  getWinRate,
  listQuotes,
  sendQuote,
  setQuoteLines,
} from "@/services/quotes";
import type { Quote, QuoteLineInput, QuotePayload } from "@/types/api/quotes";

import { useTenantKey } from "./keys";
import { useInvalidatingMutation } from "./mutations";

// Accepting a quote opens a service job, so that list moves too.
const QUOTE_KEYS = ["quotes", "quote", "quote-win-rate", "service-jobs"];

export function useQuotes(params: { status?: string } = {}) {
  const tenant = useTenantKey();
  return useQuery({ queryKey: ["quotes", tenant, params], queryFn: () => listQuotes(params) });
}

export function useQuote(id: string | undefined) {
  return useQuery({ queryKey: ["quote", id], queryFn: () => getQuote(id!), enabled: !!id });
}

export function useWinRate(from: string, to: string) {
  const tenant = useTenantKey();
  return useQuery({
    queryKey: ["quote-win-rate", tenant, from, to],
    queryFn: () => getWinRate(from, to),
  });
}

export const useCreateQuote = () =>
  useInvalidatingMutation<[QuotePayload], Quote>(createQuote, QUOTE_KEYS);
export const useSetQuoteLines = () =>
  useInvalidatingMutation<[string, QuoteLineInput[]], unknown>(setQuoteLines, QUOTE_KEYS);
export const useSendQuote = () => useInvalidatingMutation<[string], unknown>(sendQuote, QUOTE_KEYS);
export const useAcceptQuote = () =>
  useInvalidatingMutation<[string], unknown>(acceptQuote, QUOTE_KEYS);
export const useDeclineQuote = () =>
  useInvalidatingMutation<[string, string?], unknown>(declineQuote, QUOTE_KEYS);
