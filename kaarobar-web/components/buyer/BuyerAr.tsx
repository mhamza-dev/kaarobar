"use client";

import { useEffect, useState } from "react";
import { api, getSession } from "@/lib/api/client";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import {
  Alert,
  EmptyState,
  KpiCard,
  PageHeader,
  StatusBadge,
  SurfaceCard,
} from "@/components/app/ui";
import { useT } from "@/lib/i18n";

type Invoice = {
  id: string;
  business_id?: string;
  business_name?: string | null;
  invoice_number: string;
  balance_due: string;
  status: string;
};

type Balance = {
  business_id: string;
  business_name?: string | null;
  balance: string;
};

/** Buyer view of `/app/accounting`. */
export default function BuyerAr() {
  const toast = useToast();
  const t = useT();
  const [balances, setBalances] = useState<Balance[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const memberships = getSession()?.buyer_memberships || [];

  function businessName(id?: string | null) {
    if (!id) return "Store";
    return memberships.find((m) => m.business_id === id)?.business_name || id.slice(0, 8) + "…";
  }

  async function load() {
    const res = await api<{
      data: {
        balances: Balance[];
        invoices: Invoice[];
      };
    }>("/portal/ar");
    setBalances(res.data.balances || []);
    setInvoices(res.data.invoices || []);
  }

  useEffect(() => {
    void load()
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  async function pay(invoice: Invoice) {
    setBusy(true);
    setError(null);
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
      toast.success("Payment recorded");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Payment failed");
    } finally {
      setBusy(false);
    }
  }

  const openCount = invoices.filter((i) => Number(i.balance_due) > 0).length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t("marketplace.eyebrow")}
        title={t("pages.buyerArTitle")}
        description={t("pages.buyerArDesc")}
        infoKey="page.buyer.ar"
      />
      {error ? <Alert tone="error">{error}</Alert> : null}
      {loading ? (
        <p className="text-sm text-body">Loading balances…</p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <KpiCard label="Stores with balance" value={balances.length} />
            <KpiCard label="Open invoices" value={openCount} tone="warning" />
          </div>
          {balances.length === 0 && invoices.length === 0 ? (
            <EmptyState
              title="No khata activity"
              body="Balances appear when a store adds you to khata."
            />
          ) : (
            <>
              {balances.length > 0 ? (
                <ul className="grid gap-3 sm:grid-cols-2">
                  {balances.map((b) => (
                    <li key={b.business_id}>
                      <SurfaceCard className="p-4">
                        <p className="text-sm font-semibold text-heading">
                          {b.business_name || businessName(b.business_id)}
                        </p>
                        <p className="mt-2 text-2xl font-bold text-heading">Rs {b.balance}</p>
                      </SurfaceCard>
                    </li>
                  ))}
                </ul>
              ) : null}
              <ul className="space-y-3">
                {invoices.length === 0 ? (
                  <EmptyState title="No open invoices" />
                ) : (
                  invoices.map((inv) => (
                    <li key={inv.id}>
                      <SurfaceCard className="flex flex-wrap items-center justify-between gap-3 p-4">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold text-heading">{inv.invoice_number}</p>
                            <StatusBadge tone="warning">{inv.status}</StatusBadge>
                          </div>
                          <p className="mt-1 text-sm text-body">
                            {inv.business_name || businessName(inv.business_id)} · Due Rs{" "}
                            {inv.balance_due}
                          </p>
                        </div>
                        <Button size="sm" disabled={busy} onClick={() => void pay(inv)}>
                          Pay
                        </Button>
                      </SurfaceCard>
                    </li>
                  ))
                )}
              </ul>
            </>
          )}
        </>
      )}
    </div>
  );
}
