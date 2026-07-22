"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api/client";
import Button from "@/components/ui/Button";

type Invoice = {
  id: string;
  business_id?: string;
  invoice_number: string;
  balance_due: string;
  status: string;
};

/** Buyer view of `/app/accounting`. */
export default function BuyerAr() {
  const [balances, setBalances] = useState<{ business_id: string; balance: string }[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    const res = await api<{
      data: {
        balances: { business_id: string; balance: string }[];
        invoices: Invoice[];
      };
    }>("/portal/ar");
    setBalances(res.data.balances || []);
    setInvoices(res.data.invoices || []);
  }

  useEffect(() => {
    void load().catch((err) =>
      setMessage(err instanceof Error ? err.message : "Failed to load")
    );
  }, []);

  async function pay(invoice: Invoice) {
    setBusy(true);
    setMessage(null);
    try {
      await api("/portal/ar/pay", {
        method: "POST",
        body: JSON.stringify({
          invoice_id: invoice.id,
          amount: invoice.balance_due,
          method: "card",
          business_id: invoice.business_id,
        }),
      });
      setMessage("Payment recorded.");
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Payment failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-heading">Khata balance</h1>
      {message ? <p className="text-sm text-body">{message}</p> : null}
      <ul className="space-y-2">
        {balances.map((b) => (
          <li
            key={b.business_id}
            className="rounded-xl border border-border bg-white px-4 py-3 text-sm shadow-sm"
          >
            Store {b.business_id.slice(0, 8)}… · <strong>Rs {b.balance}</strong>
          </li>
        ))}
      </ul>
      <ul className="divide-y divide-border rounded-xl border border-border bg-white">
        {invoices.length === 0 ? (
          <li className="p-4 text-sm text-body">No open invoices.</li>
        ) : (
          invoices.map((inv) => (
            <li key={inv.id} className="flex items-center justify-between gap-3 p-4 text-sm">
              <div>
                <p className="font-semibold text-heading">{inv.invoice_number}</p>
                <p className="text-body">
                  Due Rs {inv.balance_due} · {inv.status}
                </p>
              </div>
              <Button size="sm" disabled={busy} onClick={() => void pay(inv)}>
                Pay
              </Button>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
