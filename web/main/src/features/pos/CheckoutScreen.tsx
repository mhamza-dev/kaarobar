"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { EmptyState } from "@/components/shared/EmptyState";
import { PageActions } from "@/components/shared/PageActions";
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
import { cn } from "@/lib/utils";
import { addLine, itemCount, removeLine, setQuantity, toCheckoutLines } from "@/stores/cart";
import type { CartLine } from "@/stores/cart";
import { useSessionStore } from "@/stores/sessionStore";
import type { Customer } from "@/types/api/crm";
import type { CheckoutLine, CheckoutPayment, Sale } from "@/types/api/sales";

import { CartPanel } from "./CartPanel";
import { HeldOrdersButton, ParkBasketButton } from "./HeldOrders";
import { CustomerPicker } from "./CustomerPicker";
import { OpenShiftPrompt } from "./OpenShiftPrompt";
import { PaymentPanel } from "./PaymentPanel";
import { ProductPicker, type PickedProduct } from "./ProductPicker";
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
  const debouncedLines = useDebounce(settlingOrder ? NO_LINES : checkoutLines, 250);
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

  // Between a basket change and its new quote, the total on screen is the
  // old basket's — the pay buttons wait it out.
  const pricing = !settlingOrder && (debouncedLines !== checkoutLines || quoting);

  const createSale = useCreateSale();
  const total = (settlingOrder ? order?.total : quote?.totals.total) ?? "0.00";

  const reset = () => {
    setLines([]);
    setPayments([]);
    setCustomer(null);
  };

  const inBasket = useMemo(
    () => new Map(lines.map((line) => [line.variantId, line.quantity])),
    [lines],
  );

  const handlePick = (product: PickedProduct) =>
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

  const totals = settlingOrder
    ? order && {
        subtotal: order.subtotal,
        discount: order.discount_total,
        tax: order.tax_total,
        rounding: null,
      }
    : lines.length > 0 && quote
      ? {
          subtotal: quote.totals.subtotal,
          discount: quote.totals.discount_total,
          tax: quote.totals.tax_total,
          rounding: quote.totals.rounding,
        }
      : null;
  const count = itemCount(lines);

  return (
    <>
      <PageActions>
        {activeRegisters.length > 1 && (
          <RegisterPicker
            registers={activeRegisters}
            value={register?.id ?? ""}
            onChange={setRegisterId}
          />
        )}
        {can("order:view") && <HeldOrdersButton currency={currency} />}
      </PageActions>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:h-full lg:min-h-0 lg:grid-cols-[minmax(0,1fr)_minmax(22rem,26rem)]">
        {settlingOrder ? (
          <div className="flex min-h-0 flex-col rounded-xl border border-border bg-card shadow-card">
            <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
              <p className="text-sm font-semibold">
                {order?.label ?? "Order"} {order?.number && `· ${order.number}`}
              </p>
              <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/pos" />}>
                New sale instead
              </Button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4">
              {unbilledItems.length === 0 ? (
                <EmptyState size="sm" title={<>Everything on this order has been paid for.</>} />
              ) : (
                <ul className="divide-y divide-border/70 text-sm">
                  {unbilledItems.map((item) => (
                    <li key={item.id} className="flex justify-between gap-3 py-2.5">
                      <span>
                        {formatQuantity(item.unbilled_quantity)} × {item.name}
                      </span>
                      <span className="font-medium tabular-nums">
                        {formatMoney(item.line_total, currency)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : (
          <ProductPicker
            onPick={handlePick}
            inBasket={inBasket}
            currency={currency}
            className="max-lg:max-h-[70vh] lg:h-full"
          />
        )}

        {/* The basket and the payment, one column: the lines scroll, the
            totals and the pay button stay put. */}
        <section
          id="basket"
          aria-label="Current sale"
          className="flex min-h-0 scroll-mt-4 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-card lg:h-full"
        >
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-4 py-3">
            <div className="flex items-baseline gap-2">
              <h2 className="text-sm font-semibold">{settlingOrder ? "Bill" : "Basket"}</h2>
              {count > 0 && (
                <span className="text-xs text-muted-foreground">
                  {count} item{count === 1 ? "" : "s"}
                </span>
              )}
            </div>
            {!settlingOrder && lines.length > 0 && (
              <div className="-mr-2 flex items-center gap-0.5">
                {can("order:create") && register && (
                  <ParkBasketButton
                    lines={checkoutLines}
                    branchId={register.branch_id}
                    registerId={register.id}
                    customerId={customer?.id}
                    onParked={reset}
                  />
                )}
                <Button variant="ghost" size="sm" onClick={reset}>
                  Clear
                </Button>
              </div>
            )}
          </div>

          {can("customer:view") && (
            <div className="shrink-0 border-b border-border px-4 py-3">
              <CustomerPicker value={customer} onChange={setCustomer} currency={currency} />
            </div>
          )}

          {!settlingOrder && (
            <div className="scrollbar-thin min-h-32 flex-1 overflow-y-auto px-4">
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
          )}

          <div
            className={cn(
              "flex shrink-0 flex-col gap-3 border-t border-border bg-muted/30 px-4 py-4",
              settlingOrder && "mt-auto",
            )}
          >
            {quoteError && !settlingOrder ? (
              <p className="rounded-lg border border-destructive/40 bg-danger-soft p-3 text-sm text-danger">
                Couldn&apos;t price this basket: {quoteError.message}
              </p>
            ) : (
              totals && (
                <div className="text-sm">
                  <Row label="Subtotal" value={formatMoney(totals.subtotal, currency)} />
                  {totals.discount && Number(totals.discount) > 0 && (
                    <Row
                      label="Discounts"
                      value={`-${formatMoney(totals.discount, currency)}`}
                      tone="success"
                    />
                  )}
                  <Row label="Tax" value={formatMoney(totals.tax, currency)} />
                  {totals.rounding && Number(totals.rounding) !== 0 && (
                    <Row label="Rounding" value={formatMoney(totals.rounding, currency)} />
                  )}
                </div>
              )
            )}

            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm font-medium text-muted-foreground">
                Total
                {quoting && !settlingOrder && (
                  <span className="ml-2 text-xs font-normal">Repricing…</span>
                )}
              </span>
              <span className="text-3xl font-semibold tracking-tight tabular-nums">
                {formatMoney(total, currency)}
              </span>
            </div>

            {(settlingOrder || lines.length > 0) && (
              <PaymentPanel
                total={total}
                currency={currency}
                payments={payments}
                onChange={setPayments}
                completing={createSale.isPending}
                pricing={pricing}
                locked={!!completed}
                customerSelected={!!customer}
                onComplete={async (tenders) => {
                  try {
                    const sale = await createSale.mutateAsync({
                      branch_id: register!.branch_id,
                      register_id: register!.id,
                      shift_id: shift.id,
                      customer_id: customer?.id,
                      ...(settlingOrder
                        ? { order_id: orderId, lines: [] }
                        : { lines: checkoutLines }),
                      payments: tenders,
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
            )}
          </div>
        </section>
      </div>

      {/* On a phone the basket sits below the catalog — this keeps the
          running total in reach and jumps down to pay. */}
      {!settlingOrder && lines.length > 0 && (
        <a
          href="#basket"
          className="fixed inset-x-3 bottom-3 z-30 flex items-center justify-between gap-3 rounded-xl bg-primary px-4 py-3 text-primary-foreground shadow-lift lg:hidden"
        >
          <span className="text-sm font-medium">
            {count} item{count === 1 ? "" : "s"} · Pay
          </span>
          <span className="text-lg font-semibold tabular-nums">{formatMoney(total, currency)}</span>
        </a>
      )}

      <ReceiptDialog sale={completed} onOpenChange={() => setCompleted(null)} />
    </>
  );
}

/** One empty basket for every render, so the debounce has nothing to chase. */
const NO_LINES: CheckoutLine[] = [];

function Row({ label, value, tone }: { label: string; value: string; tone?: "success" }) {
  return (
    <div className="flex items-baseline justify-between py-0.5">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("tabular-nums", tone === "success" && "text-success")}>{value}</span>
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
    <Select
      items={registers.map((register) => ({ value: register.id, label: register.name }))}
      value={value}
      onValueChange={(next: string | null) => onChange(next ?? "")}
    >
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
