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
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <span className="flex size-6 items-center justify-center rounded-full bg-success-soft text-success">
                  <Check className="size-4" />
                </span>
                Sale {sale.number}
              </DialogTitle>
              <DialogDescription>{formatDateTime(sale.sold_at)}</DialogDescription>
            </DialogHeader>

            {Number(sale.change_due ?? 0) > 0 && (
              <div className="rounded-lg border border-border bg-muted/40 p-3 text-center">
                <p className="text-xs text-muted-foreground">Change due</p>
                <p className="text-2xl font-semibold tabular-nums">
                  {formatMoney(sale.change_due, sale.currency)}
                </p>
              </div>
            )}

            <div className="flex max-h-64 flex-col gap-1 overflow-y-auto text-sm">
              {(sale.items ?? []).map((item) => (
                <div key={item.id} className="flex justify-between gap-2">
                  <span className="truncate">
                    {formatQuantity(item.quantity)} × {item.name}
                  </span>
                  <span className="tabular-nums">
                    {formatMoney(item.line_total, sale.currency)}
                  </span>
                </div>
              ))}
            </div>

            <div className="border-t border-border pt-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tax</span>
                <span className="tabular-nums">{formatMoney(sale.tax_total, sale.currency)}</span>
              </div>
              <div className="flex justify-between font-medium">
                <span>Total</span>
                <span className="tabular-nums">{formatMoney(sale.total, sale.currency)}</span>
              </div>
              {(sale.payments ?? []).map((payment) => (
                <div
                  key={payment.id}
                  className="flex justify-between text-xs text-muted-foreground"
                >
                  <span>{payment.method}</span>
                  <span className="tabular-nums">{formatMoney(payment.amount, sale.currency)}</span>
                </div>
              ))}
            </div>

            {sale.fiscal_number && (
              <p className="text-xs text-muted-foreground">Fiscal number: {sale.fiscal_number}</p>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setPrinting(true)}>
                <Printer className="size-4" />
                Print
              </Button>
              <Button onClick={() => onOpenChange(false)}>Next sale</Button>
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
