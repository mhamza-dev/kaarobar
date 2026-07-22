"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getPortalSession, portalApi } from "@/lib/portal-api";
import Button from "@/components/ui/Button";

type Invoice = {
  id: string;
  invoice_number: string;
  balance_due: string;
  status: string;
};

export default function PortalArPage() {
  const router = useRouter();
  const [balance, setBalance] = useState("0");
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    const res = await portalApi<{ data: { balance: string; invoices: Invoice[] } }>("/portal/ar");
    setBalance(res.data.balance);
    setInvoices(res.data.invoices || []);
  }

  useEffect(() => {
    if (!getPortalSession()) {
      router.replace("/portal/login");
      return;
    }
    void load().catch(() => router.replace("/portal/login"));
  }, [router]);

  async function pay(invoice: Invoice) {
    setBusy(true);
    setMessage(null);
    try {
      await portalApi("/portal/ar/pay", {
        method: "POST",
        body: JSON.stringify({
          invoice_id: invoice.id,
          amount: invoice.balance_due,
          method: "card",
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
      <h1 className="text-2xl font-bold text-heading">Account balance</h1>
      <p className="text-3xl font-bold text-heading">Rs {balance}</p>
      {message ? <p className="text-sm text-body">{message}</p> : null}
      <ul className="divide-y divide-border rounded-xl border border-border bg-white">
        {invoices.length === 0 ? (
          <li className="p-4 text-sm text-body">No open invoices.</li>
        ) : (
          invoices.map((i) => (
            <li key={i.id} className="flex items-center justify-between gap-3 p-4 text-sm">
              <div>
                <p className="font-semibold text-heading">{i.invoice_number}</p>
                <p className="text-body">
                  Due Rs {i.balance_due} · {i.status}
                </p>
              </div>
              <Button size="sm" loading={busy} onClick={() => void pay(i)}>
                Pay
              </Button>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
