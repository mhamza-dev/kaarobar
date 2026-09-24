"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { EmptyState } from "@/components/shared/EmptyState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useOrder } from "@/hooks/queries/useDining";
import { useCurrentShift, useRegisters } from "@/hooks/queries/useRegisters";
import { useCreateSale, useSaleQuote } from "@/hooks/queries/useSales";
import { useDebounce } from "@/hooks/useDebounce";
import { usePermission } from "@/hooks/usePermission";
import { toast } from "@/hooks/useToast";
import { formatMoney, formatQuantity } from "@/lib/format";
import { addLine, itemCount, removeLine, setQuantity, toCheckoutLines } from "@/stores/cart";
import type { CartLine } from "@/stores/cart";
import { useSessionStore } from "@/stores/sessionStore";
import type { Customer } from "@/types/api/crm";
import type { CheckoutPayment, Sale } from "@/types/api/sales";

import { CartPanel } from "./CartPanel";
import { CustomerPicker } from "./CustomerPicker";
import { OpenShiftPrompt } from "./OpenShiftPrompt";
import { PaymentPanel } from "./PaymentPanel";
import { ProductSearch, type ScannedProduct } from "./ProductSearch";
import { ReceiptDialog } from "./ReceiptDialog";

/**
 * The till.
 *
 * Mostly client state — the cart is a list of scanned quantities — but with
 * one hard rule borrowed from the backend: **the client never prices
 * anything.** Every money figure on this screen comes from
 * `POST /sales/quote`, re-run (debounced) whenever the basket changes. A
 * till that computed its own totals could show any total, and the receipt
 * would then disagree with the screen.
 *
 * With `orderId` the till settles an open ticket (a table's bill) instead of
 * a scanned basket: the lines and totals are the order's own, priced by the
 * backend when they were added, and the sale is posted with `order_id` and
 * no lines — the backend bills whatever on the order is still unpaid.
 */
export function CheckoutScreen({ orderId }: { orderId?: string } = {}) {
  const { can } = usePermission();
  const currency = useSessionStore((state) => state.scope?.business?.currency) ?? "PKR";

  const { data: registers, isLoading: loadingRegisters } = useRegisters();
  const [registerId, setRegisterId] = useState<string>("");
  const activeRegisters = useMemo(
    () => (registers ?? []).filter((register) => register.is_active),
    [registers],
  );
  const register = activeRegisters.find((r) => r.id === registerId) ?? activeRegisters[0];

  const { data: shift, isLoading: loadingShift } = useCurrentShift(register?.id);

  const [lines, setLines] = useState<CartLine[]>([]);
  const [payments, setPayments] = useState<CheckoutPayment[]>([]);
  const [completed, setCompleted] = useState<Sale | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);

  const settlingOrder = !!orderId;
  const { data: order, isLoading: loadingOrder } = useOrder(orderId);
  const unbilledItems = (order?.items ?? []).filter((item) => Number(item.unbilled_quantity) > 0);

  // Debounced so holding the +/- buttons doesn't fire a quote per press.
  const checkoutLines = useMemo(() => toCheckoutLines(lines), [lines]);
  // Settling an order never quotes a basket: an empty list keeps the quote
  // query disabled, and the order's own totals are shown instead.
  const debouncedLines = useDebounce(settlingOrder ? [] : checkoutLines, 250);
  const {
    data: quote,
    isFetching: quoting,
    error: quoteError,
  } = useSaleQuote(debouncedLines, {
    branchId: register?.branch_id,
    // Group prices and discounts depend on who is buying, so the customer
    // is part of what gets quoted — not just stamped on the sale.
    customerId: customer?.id,
  });

  const createSale = useCreateSale();
  const total = (settlingOrder ? order?.total : quote?.totals.total) ?? "0.00";

  const reset = () => {
    setLines([]);
    setPayments([]);
    setCustomer(null);
  };

  const handlePick = (product: ScannedProduct) =>
    setLines((current) =>
      addLine(current, {
        variantId: product.variantId,
        name: product.name,
        unitPrice: product.unitPrice,
      }),
    );

  if (loadingRegisters || loadingShift || (settlingOrder && loadingOrder)) {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (!can("sales:checkout")) {
    return (
      <EmptyState
        title="You can't ring up sales"
        description="Ask an owner to give your role the checkout permission."
      />
    );
  }

  if (activeRegisters.length === 0) {
    return (
      <EmptyState
        title="No register to sell from"
        description="Create a register for this branch before taking payment."
      />
    );
  }

  if (!shift || shift.status !== "open") {
    return (
      <>
        {activeRegisters.length > 1 && (
          <RegisterPicker
            registers={activeRegisters}
            value={register?.id ?? ""}
            onChange={setRegisterId}
          />
        )}
        <OpenShiftPrompt register={register!} />
      </>
    );
  }

  return (
    <>
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="flex flex-col gap-4">
          {activeRegisters.length > 1 && (
            <RegisterPicker
              registers={activeRegisters}
              value={register?.id ?? ""}
              onChange={setRegisterId}
            />
          )}

          {settlingOrder ? (
            <div className="rounded-xl border border-border bg-card p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-medium">
                  {order?.label ?? "Order"} {order?.number && `· ${order.number}`}
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  nativeButton={false}
                  render={<Link href="/pos" />}
                >
                  New sale instead
                </Button>
              </div>
              {unbilledItems.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Everything on this order has been paid for.
                </p>
              ) : (
                <ul className="divide-y divide-border text-sm">
                  {unbilledItems.map((item) => (
                    <li key={item.id} className="flex justify-between gap-3 py-2">
                      <span>
                        {formatQuantity(item.unbilled_quantity)} × {item.name}
                      </span>
                      <span className="tabular-nums">{formatMoney(item.line_total, currency)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <>
              <ProductSearch onPick={handlePick} />

              <div className="rounded-xl border border-border bg-card p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-medium">
                    Basket{" "}
                    {lines.length > 0 && (
                      <Badge variant="secondary">{itemCount(lines)} items</Badge>
                    )}
                  </p>
                  {lines.length > 0 && (
                    <Button variant="ghost" size="sm" onClick={reset}>
                      Clear
                    </Button>
                  )}
                </div>

                <CartPanel
                  lines={lines}
                  quote={quote}
                  currency={currency}
                  onSetQuantity={(variantId, quantity) =>
                    setLines((current) => setQuantity(current, variantId, quantity))
                  }
                  onRemove={(variantId) => setLines((current) => removeLine(current, variantId))}
                />
              </div>
            </>
          )}
        </div>

        <div className="flex flex-col gap-4">
          {can("customer:view") && (
            <CustomerPicker value={customer} onChange={setCustomer} currency={currency} />
          )}

          {settlingOrder && order ? (
            <div className="rounded-xl border border-border bg-card p-3 text-sm">
              <Row label="Subtotal" value={formatMoney(order.subtotal, currency)} />
              {order.discount_total && Number(order.discount_total) > 0 && (
                <Row label="Discounts" value={`-${formatMoney(order.discount_total, currency)}`} />
              )}
              <Row label="Tax" value={formatMoney(order.tax_total, currency)} />
            </div>
          ) : quoteError ? (
            <p className="rounded-lg border border-destructive/40 bg-danger-soft p-3 text-sm text-destructive">
              Couldn&apos;t price this basket: {quoteError.message}
            </p>
          ) : (
            lines.length > 0 && (
              <div className="rounded-xl border border-border bg-card p-3 text-sm">
                <Row label="Subtotal" value={formatMoney(quote?.totals.subtotal, currency)} />
                {quote?.totals.discount_total && Number(quote.totals.discount_total) > 0 && (
                  <Row
                    label="Discounts"
                    value={`-${formatMoney(quote.totals.discount_total, currency)}`}
                  />
                )}
                <Row label="Tax" value={formatMoney(quote?.totals.tax_total, currency)} />
                {quote?.totals.rounding && Number(quote.totals.rounding) !== 0 && (
                  <Row label="Rounding" value={formatMoney(quote.totals.rounding, currency)} />
                )}
                {quoting && <p className="mt-1 text-xs text-muted-foreground">Repricing…</p>}
              </div>
            )
          )}

          <PaymentPanel
            total={total}
            currency={currency}
            payments={payments}
            onChange={setPayments}
            completing={createSale.isPending}
            customerSelected={!!customer}
            onComplete={async () => {
              try {
                const sale = await createSale.mutateAsync({
                  branch_id: register!.branch_id,
                  register_id: register!.id,
                  shift_id: shift.id,
                  customer_id: customer?.id,
                  ...(settlingOrder ? { order_id: orderId, lines: [] } : { lines: checkoutLines }),
                  payments,
                });

                setCompleted(sale);
                reset();
                toast.success(`Sale ${sale.number} completed`);
              } catch {
                // Toasted by the hook; the basket and tenders are left intact
                // so the cashier can retry rather than re-scan everything.
              }
            }}
          />
        </div>
      </div>

      <ReceiptDialog sale={completed} onOpenChange={() => setCompleted(null)} />
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between py-0.5">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

function RegisterPicker({
  registers,
  value,
  onChange,
}: {
  registers: Array<{ id: string; name: string }>;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Select value={value} onValueChange={(next: string | null) => onChange(next ?? "")}>
      <SelectTrigger className="w-auto" aria-label="Register">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {registers.map((register) => (
          <SelectItem key={register.id} value={register.id}>
            {register.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
