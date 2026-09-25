"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useAllocateCustomerPayment } from "@/hooks/queries/useCustomers";
import { toast } from "@/hooks/useToast";
import { formatDate, formatMoney } from "@/lib/format";
import type { CreditInvoice, CustomerPayment } from "@/types/api/crm";

/**
 * Matches a payment on account to the invoices it pays. By hand — the
 * customer said which bills they were settling — or oldest first, which is
 * a guess the person has to choose to make. The backend refuses anything
 * that would allocate more than the payment or an invoice holds.
 */
export function AllocatePaymentDialog({
  payment,
  invoices,
  currency,
  onOpenChange,
}: {
  payment: CustomerPayment | null;
  invoices: CreditInvoice[];
  currency: string;
  onOpenChange: (open: boolean) => void;
}) {
  const allocate = useAllocateCustomerPayment();
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const open = invoices.filter((invoice) => Number(invoice.outstanding) > 0);

  const close = () => {
    setAmounts({});
    onOpenChange(false);
  };

  const run = async (payload: { allocations: Record<string, string> } | { auto: true }) => {
    if (!payment) return;
    try {
      await allocate.mutateAsync([payment.id, payload]);
      toast.success(`${payment.number} matched to invoices`);
      close();
    } catch {
      // Toasted by the hook.
    }
  };

  return (
    <Dialog open={!!payment} onOpenChange={(next) => !next && close()}>
      {payment && (
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Match {payment.number} to invoices</DialogTitle>
            <DialogDescription>
              {formatMoney(payment.amount, currency)} paid on {formatDate(payment.paid_on)}.
              Whatever isn&apos;t matched stays on the account.
            </DialogDescription>
          </DialogHeader>

          {open.length === 0 ? (
            <p className="text-sm text-muted-foreground">This customer has no unpaid invoices.</p>
          ) : (
            <div className="flex max-h-72 flex-col divide-y divide-border overflow-y-auto">
              {open.map((invoice) => (
                <div key={invoice.sale_id} className="flex items-center gap-3 py-2 text-sm">
                  <div className="flex-1">
                    <p className="font-medium">{invoice.number}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatMoney(invoice.outstanding, currency)} outstanding · due{" "}
                      {formatDate(invoice.due_on)}
                    </p>
                  </div>
                  <Input
                    value={amounts[invoice.sale_id] ?? ""}
                    inputMode="decimal"
                    placeholder="0"
                    aria-label={`Amount towards ${invoice.number}`}
                    className="w-28 text-right"
                    onChange={(event) =>
                      setAmounts((current) => ({
                        ...current,
                        [invoice.sale_id]: event.target.value,
                      }))
                    }
                  />
                </div>
              ))}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              disabled={allocate.isPending || open.length === 0}
              onClick={() => run({ auto: true })}
            >
              Oldest first
            </Button>
            <Button
              disabled={allocate.isPending || open.length === 0}
              onClick={() => {
                const allocations = Object.fromEntries(
                  Object.entries(amounts).filter(([, amount]) => Number(amount) > 0),
                );
                if (Object.keys(allocations).length === 0) {
                  toast.error("Enter an amount against at least one invoice");
                  return;
                }
                void run({ allocations });
              }}
            >
              {allocate.isPending && <Loader2 className="size-4 animate-spin" />}
              Match
            </Button>
          </DialogFooter>
        </DialogContent>
      )}
    </Dialog>
  );
}
