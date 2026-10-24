"use client";

import { Banknote, CreditCard, Loader2, Smartphone, X, type LucideIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useIsApple } from "@/hooks/useIsApple";
import { formatMoney } from "@/lib/format";
import { paymentMethodLabel } from "@/lib/paymentMethods";
import {
  changeDue,
  fromMinor,
  isSettled,
  isValidPayment,
  quickCashAmounts,
  remainingDue,
  suggestedAmount,
  toMinor,
} from "@/lib/tender";
import { cn } from "@/lib/utils";
import { CASH_METHODS, PAYMENT_METHODS, type CheckoutPayment } from "@/types/api/sales";

/** What most sales are paid with — one tap each; the rest sit under "More". */
const QUICK_METHODS: Array<{ method: string; icon: LucideIcon }> = [
  { method: "cash", icon: Banknote },
  { method: "card", icon: CreditCard },
  { method: "wallet", icon: Smartphone },
].filter((quick) => (PAYMENT_METHODS as readonly string[]).includes(quick.method));

const OTHER_METHODS = PAYMENT_METHODS.filter(
  (option) => !QUICK_METHODS.some((quick) => quick.method === option),
);

/**
 * Taking payment, including a split across several methods.
 *
 * Totals come from the quote; this panel only does the arithmetic between a
 * known total and the tenders being entered (see `src/lib/tender.ts`). The
 * backend recomputes both the settled amount and the change when the sale is
 * written, and its answer is authoritative — what is shown here exists so
 * the cashier isn't doing mental arithmetic with a queue waiting.
 *
 * The common sale is one tender for the whole amount, so the big button
 * charges what's entered and completes the sale in one go. "Add payment"
 * is there for splitting: it sets a tender aside and asks for the rest.
 */
export function PaymentPanel({
  total,
  currency,
  payments,
  onChange,
  onComplete,
  completing,
  pricing,
  locked,
  customerSelected,
}: {
  total: string;
  currency: string;
  payments: CheckoutPayment[];
  onChange: (payments: CheckoutPayment[]) => void;
  /** Called with the full set of tenders, including one just charged. */
  onComplete: (payments: CheckoutPayment[]) => void;
  completing: boolean;
  /**
   * The basket has changed since the total was quoted. Nothing may be
   * charged against a total that's about to be replaced.
   */
  pricing: boolean;
  /** A receipt is on screen — the sale it's for has already been charged. */
  locked: boolean;
  customerSelected: boolean;
}) {
  const [method, setMethod] = useState<string>("cash");
  const [amount, setAmount] = useState("");
  const [tendered, setTendered] = useState("");
  const apple = useIsApple();

  const due = remainingDue(total, payments);
  const settled = isSettled(total, payments);
  const isCash = CASH_METHODS.includes(method as (typeof CASH_METHODS)[number]);
  const quickPicked = QUICK_METHODS.some((quick) => quick.method === method);

  // Selling on account posts to a customer's ledger, so there has to be a
  // customer to post it to.
  const creditWithoutCustomer = method === "credit" && !customerSelected;

  // Until the quote lands there is no total to tender against, and a payment
  // added now would be silently dropped as invalid — leaving the cashier
  // clicking a button that appears to do nothing.
  const totalKnown = toMinor(total) > 0 && !pricing;

  const entry: CheckoutPayment = {
    method,
    amount: amount || suggestedAmount(total, payments),
    tendered_amount: isCash && tendered ? tendered : undefined,
  };
  const entryValid = isValidPayment(entry);
  const shortTendered = isCash && !!tendered && toMinor(tendered) < toMinor(entry.amount);

  // What the drawer owes back, live as "cash given" is typed — before the
  // tender is even added.
  const change = changeDue(settled ? payments : [...payments, ...(entryValid ? [entry] : [])]);

  const clearEntry = () => {
    setAmount("");
    setTendered("");
  };

  const addPayment = () => {
    if (!entryValid) return;
    onChange([...payments, entry]);
    clearEntry();
  };

  const charge = () => {
    if (completing || locked || pricing) return;
    if (settled) {
      onComplete(payments);
      return;
    }
    if (!totalKnown || creditWithoutCustomer || !entryValid) return;
    const next = [...payments, entry];
    onChange(next);
    clearEntry();
    // A part-payment is set aside like "Add payment"; the rest is still due.
    if (isSettled(total, next)) onComplete(next);
  };

  // ⌘/Ctrl+Enter charges from anywhere on the till, inputs included.
  const chargeRef = useRef(charge);
  useEffect(() => {
    chargeRef.current = charge;
  });
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        chargeRef.current();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const chargeDisabled =
    completing ||
    locked ||
    pricing ||
    (!settled && (!totalKnown || creditWithoutCustomer || !entryValid));

  return (
    <div className="flex flex-col gap-3">
      {payments.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {payments.map((payment, index) => (
            <li
              key={`${payment.method}-${index}`}
              className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
            >
              <span className="font-medium">{paymentMethodLabel(payment.method)}</span>
              {payment.tendered_amount && (
                <span className="text-xs text-muted-foreground">
                  given {formatMoney(payment.tendered_amount, currency)}
                </span>
              )}
              <span className="ml-auto tabular-nums">{formatMoney(payment.amount, currency)}</span>
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label={`Remove ${paymentMethodLabel(payment.method)} payment`}
                onClick={() => onChange(payments.filter((_, i) => i !== index))}
                className="-mr-1 text-muted-foreground"
              >
                <X />
              </Button>
            </li>
          ))}
        </ul>
      )}

      {!settled && (
        <>
          <div className="flex flex-col gap-1.5">
            <Label id="tender-method-label" className="sr-only">
              Method
            </Label>
            <div
              role="group"
              aria-labelledby="tender-method-label"
              className="grid grid-cols-4 gap-1.5"
            >
              {QUICK_METHODS.map(({ method: option, icon: Icon }) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={method === option}
                  onClick={() => setMethod(option)}
                  className={cn(
                    "flex h-11 flex-col items-center justify-center gap-0.5 rounded-lg border text-xs font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                    method === option
                      ? "border-primary bg-accent text-accent-foreground"
                      : "border-border bg-background hover:bg-muted",
                  )}
                >
                  <Icon className="size-4" aria-hidden />
                  {paymentMethodLabel(option)}
                </button>
              ))}
              <Select
                items={OTHER_METHODS.map((option) => ({
                  value: option,
                  label: paymentMethodLabel(option),
                }))}
                value={quickPicked ? null : method}
                onValueChange={(value: string | null) => setMethod(value ?? "cash")}
              >
                <SelectTrigger
                  aria-label="More payment methods"
                  className={cn(
                    "h-11! w-full min-w-0 px-2 text-xs font-medium",
                    !quickPicked && "border-primary bg-accent text-accent-foreground",
                  )}
                >
                  <SelectValue placeholder="More…" />
                </SelectTrigger>
                <SelectContent>
                  {OTHER_METHODS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {paymentMethodLabel(option)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className={cn("flex flex-col gap-1", !isCash && "col-span-2")}>
              <Label htmlFor="tender-amount" className="text-xs text-muted-foreground">
                Amount
              </Label>
              <Input
                id="tender-amount"
                inputMode="decimal"
                value={amount}
                placeholder={suggestedAmount(total, payments)}
                onChange={(event) => setAmount(event.target.value)}
                className="tabular-nums"
              />
            </div>

            {isCash && (
              <div className="flex flex-col gap-1">
                <Label htmlFor="tender-given" className="text-xs text-muted-foreground">
                  Cash given
                </Label>
                <Input
                  id="tender-given"
                  inputMode="decimal"
                  value={tendered}
                  placeholder="For change"
                  onChange={(event) => setTendered(event.target.value)}
                  aria-invalid={shortTendered || undefined}
                  className="tabular-nums"
                />
              </div>
            )}
          </div>

          {isCash && totalKnown && (
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Quick cash amounts">
              {quickCashAmounts(toMinor(entry.amount)).map((minor, index) => (
                <button
                  key={minor}
                  type="button"
                  onClick={() => setTendered(fromMinor(minor))}
                  aria-pressed={toMinor(tendered) === minor}
                  className={cn(
                    "h-7 rounded-md border px-2.5 text-xs font-medium tabular-nums transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                    toMinor(tendered) === minor
                      ? "border-primary bg-accent text-accent-foreground"
                      : "border-border bg-background hover:bg-muted",
                  )}
                >
                  {index === 0 ? "Exact" : formatMoney(fromMinor(minor), currency)}
                </button>
              ))}
            </div>
          )}

          {shortTendered && (
            <p className="text-xs text-danger">
              That&apos;s less than the amount — check the cash given.
            </p>
          )}
          {creditWithoutCustomer && (
            <p className="text-xs text-danger">
              Pick a customer before selling on account — the balance has to go somewhere.
            </p>
          )}
        </>
      )}

      {(payments.length > 0 || change > 0) && (
        <div className="flex items-baseline justify-between gap-3 rounded-lg bg-muted/60 px-3 py-2">
          <span className="text-sm text-muted-foreground">
            {due > 0 && payments.length > 0 ? "Still due" : "Change"}
          </span>
          <span
            className={cn(
              "text-lg font-semibold tabular-nums",
              due > 0 && payments.length > 0 ? "text-danger" : "text-success",
            )}
          >
            {due > 0 && payments.length > 0
              ? formatMoney(fromMinor(due), currency)
              : formatMoney(fromMinor(change), currency)}
          </span>
        </div>
      )}

      <div className="flex gap-2">
        {!settled && (
          <Button
            variant="outline"
            size="lg"
            onClick={addPayment}
            disabled={creditWithoutCustomer || !totalKnown || !entryValid}
            className="h-12"
          >
            Add payment
          </Button>
        )}
        <Button
          size="lg"
          disabled={chargeDisabled}
          onClick={charge}
          aria-keyshortcuts={apple ? "Meta+Enter" : "Control+Enter"}
          className="h-12 flex-1 text-base"
        >
          {completing && <Loader2 className="size-4 animate-spin" />}
          {pricing
            ? "Pricing…"
            : settled || !totalKnown
              ? "Complete sale"
              : `Charge ${formatMoney(entry.amount, currency)}`}
        </Button>
      </div>
    </div>
  );
}
