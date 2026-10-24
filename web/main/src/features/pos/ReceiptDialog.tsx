"use client";

import { Check, Printer } from "lucide-react";
import { useState } from "react";

import { DocumentPreview } from "@/components/shared/DocumentPreview";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDateTime, formatMoney, formatQuantity } from "@/lib/format";
import { paymentMethodLabel } from "@/lib/paymentMethods";
import { getReceiptHtml } from "@/services/reports";
import type { Sale } from "@/types/api/sales";

/**
 * What the cashier sees the moment a sale completes: the number to quote,
 * the change to hand back, and the lines as the backend recorded them.
 *
 * Every figure here is the sale's own — including `change_due`, which the
 * backend computed. The payment panel's live figure was a convenience; this
 * is the record.
 */
export function ReceiptDialog({
  sale,
  onOpenChange,
}: {
  sale: Sale | null;
  onOpenChange: (open: boolean) => void;
}) {
  // Printing goes through the backend's receipt page, not `window.print()`
  // on this screen — the printed slip should be the same document a reprint
  // produces, sized for the roll.
  const [printing, setPrinting] = useState(false);

  return (
    <>
      <Dialog open={!!sale} onOpenChange={onOpenChange}>
        {sale && (
          <DialogContent className="gap-5 sm:max-w-md">
            <DialogHeader className="items-center text-center">
              <span className="mb-1 flex size-12 animate-pop items-center justify-center rounded-full bg-success-soft text-success ring-8 ring-success-soft/40">
                <Check className="size-6" strokeWidth={2.5} />
              </span>
              <DialogTitle className="text-lg">Sale {sale.number}</DialogTitle>
              <DialogDescription>
                {formatDateTime(sale.sold_at)} · {formatMoney(sale.total, sale.currency)}
              </DialogDescription>
            </DialogHeader>

            {Number(sale.change_due ?? 0) > 0 && (
              <div className="rounded-xl border border-success/20 bg-success-soft/60 p-4 text-center">
                <p className="text-xs font-medium text-success">Change due</p>
                <p className="text-3xl font-semibold tracking-tight tabular-nums">
                  {formatMoney(sale.change_due, sale.currency)}
                </p>
              </div>
            )}

            <div className="flex max-h-56 flex-col gap-1.5 overflow-y-auto text-sm">
              {(sale.items ?? []).map((item) => (
                <div key={item.id} className="flex justify-between gap-3">
                  <span className="truncate">
                    <span className="text-muted-foreground tabular-nums">
                      {formatQuantity(item.quantity)} ×
                    </span>{" "}
                    {item.name}
                  </span>
                  <span className="tabular-nums">
                    {formatMoney(item.line_total, sale.currency)}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-1 border-t border-dashed border-border pt-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tax</span>
                <span className="tabular-nums">{formatMoney(sale.tax_total, sale.currency)}</span>
              </div>
              <div className="flex justify-between font-semibold">
                <span>Total</span>
                <span className="tabular-nums">{formatMoney(sale.total, sale.currency)}</span>
              </div>
              {(sale.payments ?? []).map((payment) => (
                <div
                  key={payment.id}
                  className="flex justify-between text-xs text-muted-foreground"
                >
                  <span>Paid by {paymentMethodLabel(payment.method).toLowerCase()}</span>
                  <span className="tabular-nums">{formatMoney(payment.amount, sale.currency)}</span>
                </div>
              ))}
            </div>

            {sale.fiscal_number && (
              <p className="text-xs text-muted-foreground">Fiscal number: {sale.fiscal_number}</p>
            )}

            <DialogFooter className="sm:justify-stretch">
              <Button variant="outline" onClick={() => setPrinting(true)} className="sm:flex-1">
                <Printer className="size-4" />
                Print receipt
              </Button>
              <Button autoFocus onClick={() => onOpenChange(false)} className="sm:flex-1">
                Next sale
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
      {sale && (
        <DocumentPreview
          open={printing}
          onOpenChange={setPrinting}
          title={`Receipt ${sale.number}`}
          queryKey={["receipt", sale.id]}
          fetchHtml={(paper) => getReceiptHtml(sale.id, { paper })}
          papers={["80mm", "76mm", "58mm", "A4"]}
          defaultPaper="80mm"
        />
      )}
    </>
  );
}
