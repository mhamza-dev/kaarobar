"use client";

import { Loader2, Trash2 } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
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
import { formatMoney } from "@/lib/format";
import {
  changeDue,
  fromMinor,
  isSettled,
  isValidPayment,
  remainingDue,
  suggestedAmount,
  toMinor,
} from "@/lib/tender";
import { cn } from "@/lib/utils";
import { CASH_METHODS, PAYMENT_METHODS, type CheckoutPayment } from "@/types/api/sales";

const METHOD_LABELS: Record<string, string> = {
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

/**
 * Taking payment, including a split across several methods.
 *
 * Totals come from the quote; this panel only does the arithmetic between a
 * known total and the tenders being entered (see `src/lib/tender.ts`). The
 * backend recomputes both the settled amount and the change when the sale is
 * written, and its answer is authoritative — what is shown here exists so
 * the cashier isn't doing mental arithmetic with a queue waiting.
 */
export function PaymentPanel({
  total,
  currency,
  payments,
  onChange,
  onComplete,
  completing,
  customerSelected,
}: {
  total: string;
  currency: string;
  payments: CheckoutPayment[];
  onChange: (payments: CheckoutPayment[]) => void;
  onComplete: () => void;
  completing: boolean;
  customerSelected: boolean;
}) {
  const [method, setMethod] = useState<string>("cash");
  const [amount, setAmount] = useState("");
  const [tendered, setTendered] = useState("");

  const due = remainingDue(total, payments);
  const change = changeDue(payments);
  const settled = isSettled(total, payments);
  const isCash = CASH_METHODS.includes(method as (typeof CASH_METHODS)[number]);

  // Selling on account posts to a customer's ledger, so there has to be a
  // customer to post it to.
  const creditWithoutCustomer = method === "credit" && !customerSelected;

  // Until the quote lands there is no total to tender against, and a payment
  // added now would be silently dropped as invalid — leaving the cashier
  // clicking a button that appears to do nothing.
  const totalKnown = toMinor(total) > 0;

  const addPayment = () => {
    const entry: CheckoutPayment = {
      method,
      amount: amount || suggestedAmount(total, payments),
      tendered_amount: isCash && tendered ? tendered : undefined,
    };

    if (!isValidPayment(entry)) return;

    onChange([...payments, entry]);
    setAmount("");
    setTendered("");
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border border-border p-3">
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-muted-foreground">Total</span>
          <span className="text-2xl font-semibold tabular-nums">
            {formatMoney(total, currency)}
          </span>
        </div>
        <div className="mt-1 flex items-baseline justify-between">
          <span className="text-sm text-muted-foreground">{due > 0 ? "Still due" : "Change"}</span>
          <span
            className={cn(
              "text-lg font-medium tabular-nums",
              due > 0 ? "text-destructive" : change > 0 ? "text-success" : undefined,
            )}
          >
            {due > 0
              ? formatMoney(fromMinor(due), currency)
              : formatMoney(fromMinor(change), currency)}
          </span>
        </div>
      </div>

      {payments.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {payments.map((payment, index) => (
            <div
              key={`${payment.method}-${index}`}
              className="flex items-center gap-2 rounded-lg border border-border px-3 py-2"
            >
              <Badge variant="secondary">{METHOD_LABELS[payment.method] ?? payment.method}</Badge>
              <span className="flex-1 text-sm tabular-nums">
                {formatMoney(payment.amount, currency)}
              </span>
              {payment.tendered_amount && (
                <span className="text-xs text-muted-foreground">
                  given {formatMoney(payment.tendered_amount, currency)}
                </span>
              )}
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove ${payment.method} payment`}
                onClick={() => onChange(payments.filter((_, i) => i !== index))}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {!settled && (
        <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tender-method">Method</Label>
            <Select
              value={method}
              onValueChange={(value: string | null) => setMethod(value ?? "cash")}
            >
              <SelectTrigger id="tender-method">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {METHOD_LABELS[option]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tender-amount">Amount</Label>
              <Input
                id="tender-amount"
                inputMode="decimal"
                value={amount}
                placeholder={suggestedAmount(total, payments)}
                onChange={(event) => setAmount(event.target.value)}
              />
            </div>

            {isCash && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="tender-given">Cash given</Label>
                <Input
                  id="tender-given"
                  inputMode="decimal"
                  value={tendered}
                  placeholder="For change"
                  onChange={(event) => setTendered(event.target.value)}
                />
              </div>
            )}
          </div>

          {creditWithoutCustomer && (
            <p className="text-xs text-destructive">
              Pick a customer before selling on account — the balance has to go somewhere.
            </p>
          )}

          <Button
            variant="outline"
            onClick={addPayment}
            disabled={creditWithoutCustomer || !totalKnown}
          >
            {totalKnown ? "Add payment" : "Pricing…"}
          </Button>
        </div>
      )}

      <Button size="lg" disabled={!settled || completing} onClick={onComplete} className="w-full">
        {completing && <Loader2 className="size-4 animate-spin" />}
        Complete sale
      </Button>
    </div>
  );
}
