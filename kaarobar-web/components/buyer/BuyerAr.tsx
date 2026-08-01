"use client";

import { useEffect, useState } from "react";
import { api, getSession } from "@/lib/api/client";
import Button from "@/components/ui/Button";
import Modal from "@/components/modals/Modal";
import { useToast } from "@/components/ui/Toast";
import {
  Alert,
  EmptyState,
  KpiCard,
  PageHeader,
  StatusBadge,
} from "@/components/app/ui";
import { BuyerArSkeleton } from "@/components/buyer/BuyerSkeletons";
import { useT } from "@/lib/i18n";

type Invoice = {
  id: string;
  business_id?: string;
  business_name?: string | null;
  invoice_number: string;
  total_amount?: string;
  balance_due: string;
  status: string;
  due_date?: string | null;
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
  const [selected, setSelected] = useState<Invoice | null>(null);

  const memberships = getSession()?.buyer_memberships || [];

  function businessName(id?: string | null) {
    if (!id) return t("marketplace.store");
    return (
      memberships.find((m) => m.business_id === id)?.business_name ||
      id.slice(0, 8) + "…"
    );
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
      toast.success(t("marketplace.paymentRecorded"));
      setSelected(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("marketplace.paymentFailed"));
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
        <BuyerArSkeleton />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <KpiCard
              label={t("marketplace.storesWithBalance")}
              value={balances.length}
            />
            <KpiCard
              label={t("marketplace.openInvoices")}
              value={openCount}
              tone="warning"
            />
          </div>
          {balances.length === 0 && invoices.length === 0 ? (
            <EmptyState
              title={t("marketplace.emptyArTitle")}
              body={t("marketplace.emptyArBody")}
            />
          ) : (
            <>
              {balances.length > 0 ? (
                <ul className="grid gap-3 sm:grid-cols-2">
                  {balances.map((b) => (
                    <li key={b.business_id}>
                      <div className="rounded-md border border-border bg-card p-5 shadow-sm">
                        <p className="text-sm font-semibold text-heading">
                          {b.business_name || businessName(b.business_id)}
                        </p>
                        <p className="mt-2 text-2xl font-bold text-heading">
                          Rs {b.balance}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : null}
              <ul className="space-y-3">
                {invoices.length === 0 ? (
                  <EmptyState title={t("marketplace.noOpenInvoices")} />
                ) : (
                  invoices.map((inv) => (
                    <li key={inv.id}>
                      <button
                        type="button"
                        onClick={() => setSelected(inv)}
                        className="flex w-full flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-card p-4 text-left shadow-sm transition hover:border-brand/30 hover:shadow-md"
                      >
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold text-heading">
                              {inv.invoice_number}
                            </p>
                            <StatusBadge tone="warning">{inv.status}</StatusBadge>
                          </div>
                          <p className="mt-1 text-sm text-body">
                            {inv.business_name || businessName(inv.business_id)} ·{" "}
                            {t("marketplace.due")} Rs {inv.balance_due}
                          </p>
                        </div>
                        <span className="text-sm font-semibold text-brand">
                          {t("marketplace.viewDetails")} →
                        </span>
                      </button>
                    </li>
                  ))
                )}
              </ul>
            </>
          )}
        </>
      )}

      <Modal
        isOpen={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.invoice_number}
        description={
          selected
            ? selected.business_name || businessName(selected.business_id)
            : undefined
        }
        size="md"
        footer={
          selected ? (
            <Button
              className="w-full rounded-md sm:w-auto"
              loading={busy}
              onClick={() => void pay(selected)}
            >
              {t("marketplace.payNow")} · Rs {selected.balance_due}
            </Button>
          ) : null
        }
      >
        {selected ? (
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-body">{t("common.status")}</dt>
              <dd>
                <StatusBadge tone="warning">{selected.status}</StatusBadge>
              </dd>
            </div>
            {selected.total_amount ? (
              <div className="flex justify-between gap-4">
                <dt className="text-body">{t("common.total")}</dt>
                <dd className="font-semibold text-heading">
                  Rs {selected.total_amount}
                </dd>
              </div>
            ) : null}
            <div className="flex justify-between gap-4">
              <dt className="text-body">{t("marketplace.balanceDue")}</dt>
              <dd className="text-lg font-bold text-heading">
                Rs {selected.balance_due}
              </dd>
            </div>
            {selected.due_date ? (
              <div className="flex justify-between gap-4">
                <dt className="text-body">{t("marketplace.dueDate")}</dt>
                <dd className="font-semibold text-heading">
                  {String(selected.due_date)}
                </dd>
              </div>
            ) : null}
          </dl>
        ) : null}
      </Modal>
    </div>
  );
}
