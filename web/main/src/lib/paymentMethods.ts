import { humanize } from "@/lib/format";

/** What each tender is called at the counter and on screen. */
export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: "Cash",
  card: "Card",
  wallet: "Wallet",
  bank_transfer: "Bank transfer",
  cheque: "Cheque",
  credit: "On account",
  gift_card: "Gift card",
  loyalty: "Loyalty points",
  store_credit: "Store credit",
  other: "Other",
};

/** A tender's name; one the backend adds later still reads as words. */
export function paymentMethodLabel(method: string): string {
  return PAYMENT_METHOD_LABELS[method] ?? humanize(method);
}
