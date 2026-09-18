import type { CheckoutPayment, PaymentMethod } from "@/types/api/sales";
import { CASH_METHODS } from "@/types/api/sales";

/**
 * Split-tender arithmetic for the payment step.
 *
 * Deliberately narrow: the *total* is never computed here — it comes from
 * `POST /sales/quote`, because `Kaarobar.Sales.Checkout` is the only thing
 * allowed to price a basket. What this does is the arithmetic the cashier
 * needs *between* a known total and the tenders they are entering: how much
 * is still owed, and how much change to hand back.
 *
 * The backend recomputes both when the sale is written, and its answer wins.
 * These exist so the counter isn't doing mental arithmetic while a queue
 * waits.
 *
 * Money is handled in integer minor units internally — `0.1 + 0.2` in
 * floating point is `0.30000000000000004`, and a till that is a hundredth of
 * a rupee out is a till nobody trusts.
 */

/** Decimal string → integer minor units (2dp). NaN-safe, returns 0. */
export function toMinor(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === "") return 0;
  const amount = Number(value);
  if (Number.isNaN(amount)) return 0;
  return Math.round(amount * 100);
}

/** Integer minor units → the 2dp decimal string the API expects. */
export function fromMinor(minor: number): string {
  return (minor / 100).toFixed(2);
}

/** What has been tendered so far, counting each payment's settled amount. */
export function totalTendered(payments: CheckoutPayment[]): number {
  return payments.reduce((sum, payment) => sum + toMinor(payment.amount), 0);
}

/**
 * What is still owed. Never negative — an overpayment is change, not a
 * negative balance, and showing "-50 due" at a till reads as an error.
 */
export function remainingDue(total: string, payments: CheckoutPayment[]): number {
  return Math.max(0, toMinor(total) - totalTendered(payments));
}

/**
 * Change owed to the customer.
 *
 * Only cash produces change: handing back money against a card tender would
 * be a refund to a different instrument. Computed from what was physically
 * handed over (`tendered_amount`) beyond what that payment settles.
 */
export function changeDue(payments: CheckoutPayment[]): number {
  return payments.reduce((sum, payment) => {
    if (!CASH_METHODS.includes(payment.method as PaymentMethod)) return sum;
    const tendered = toMinor(payment.tendered_amount);
    if (tendered === 0) return sum;
    return sum + Math.max(0, tendered - toMinor(payment.amount));
  }, 0);
}

/** True once the tenders cover the total — the point the sale may be completed. */
export function isSettled(total: string, payments: CheckoutPayment[]): boolean {
  return toMinor(total) > 0 && remainingDue(total, payments) === 0;
}

/**
 * The amount to pre-fill when adding a tender: whatever is still owed, so
 * the common case (one payment for the whole sale) is a single click.
 */
export function suggestedAmount(total: string, payments: CheckoutPayment[]): string {
  return fromMinor(remainingDue(total, payments));
}

/**
 * Whether a tender line is usable as entered.
 *
 * A cash payment may be tendered for more than it settles (that is change);
 * anything else tendered above its amount is a data-entry slip, since there
 * is nothing to hand back.
 */
export function isValidPayment(payment: CheckoutPayment): boolean {
  const amount = toMinor(payment.amount);
  if (amount <= 0) return false;

  const isCash = CASH_METHODS.includes(payment.method as PaymentMethod);
  if (!isCash) return true;

  const tendered = toMinor(payment.tendered_amount);
  return tendered === 0 || tendered >= amount;
}
