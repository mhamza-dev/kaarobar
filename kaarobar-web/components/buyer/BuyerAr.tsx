"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Wallet } from "lucide-react";
import { api, getSession } from "@/lib/api/client";
import Button from "@/components/ui/Button";
import Modal from "@/components/modals/Modal";
import { useToast } from "@/components/ui/Toast";
import {
  Alert,
  KpiCard,
  StatusBadge,
} from "@/components/app/ui";
import {
  BuyerBackLink,
  BuyerCard,
  BuyerEmptyPanel,
  BuyerHero,
} from "@/components/buyer/BuyerLayout";
import { BuyerArSkeleton } from "@/components/buyer/BuyerSkeletons";
import { useT } from "@/lib/i18n";
import { portalKeys } from "@/lib/queryClient";

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

type ArPayload = {
  balances: Balance[];
  invoices: Invoice[];
};

/** Buyer view of `/app/accounting`. */
export default function BuyerAr() {
  const toast = useToast();
  const t = useT();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Invoice | null>(null);

  const memberships = getSession()?.buyer_memberships || [];

  function businessName(id?: string | null) {
    if (!id) return t("marketplace.store");
    return (
      memberships.find((m) => m.business_id === id)?.business_name ||
      id.slice(0, 8) + "…"
    );
  }

  const arQuery = useQuery({
    queryKey: portalKeys.ar(),
    queryFn: async (): Promise<ArPayload> => {
      const res = await api<{
        data: {
          balances: Balance[];
          invoices: Invoice[];
        };
      }>("/portal/ar");
      return {
        balances: res.data.balances || [],
        invoices: res.data.invoices || [],
      };
    },
  });

  const payMutation = useMutation({
    mutationFn: (invoice: Invoice) =>
      api("/portal/ar/pay", {
        method: "POST",
        body: JSON.stringify({
          invoice_id: invoice.id,
          amount: invoice.balance_due,
          method: "wallet",
        }),
      }),
    onSuccess: () => {
      toast.success(t("marketplace.paymentRecorded"));
      setSelected(null);
      void queryClient.invalidateQueries({ queryKey: portalKeys.ar() });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : t("marketplace.paymentFailed"));
    },
  });

  const balances = arQuery.data?.balances || [];
  const invoices = arQuery.data?.invoices || [];
  const loading = arQuery.isLoading;
  const errorMessage =
    arQuery.error instanceof Error
      ? arQuery.error.message
      : arQuery.error
        ? "Failed to load"
        : null;
  const openCount = invoices.filter((i) => Number(i.balance_due) > 0).length;

  return (
    <div className="space-y-6">
      <BuyerBackLink href="/app/account">{t("nav.account")}</BuyerBackLink>
      <BuyerHero
        eyebrow={t("marketplace.eyebrow")}
        title={t("pages.buyerArTitle")}
        description={t("pages.buyerArDesc")}
        infoKey="page.buyer.ar"
      />
      {errorMessage ? <Alert tone="error">{errorMessage}</Alert> : null}
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
            <BuyerEmptyPanel
              icon={<Wallet className="h-7 w-7" />}
              title={t("marketplace.emptyArTitle")}
              body={t("marketplace.emptyArBody")}
              action={
                <Link
                  href="/app"
                  className="inline-flex rounded-md bg-brand px-5 py-2.5 text-sm font-semibold text-brand-foreground"
                >
                  {t("marketplace.browseStores")}
                </Link>
              }
            />
          ) : (
            <>
              {balances.length > 0 ? (
                <ul className="grid gap-3 sm:grid-cols-2">
                  {balances.map((b) => (
                    <li key={b.business_id}>
                      <BuyerCard className="p-5">
                        <p className="text-sm font-semibold text-heading">
                          {b.business_name || businessName(b.business_id)}
                        </p>
                        <p className="mt-2 text-2xl font-bold text-heading">
                          Rs {b.balance}
                        </p>
                      </BuyerCard>
                    </li>
                  ))}
                </ul>
              ) : null}
              <ul className="space-y-3">
                {invoices.length === 0 ? (
                  <BuyerEmptyPanel title={t("marketplace.noOpenInvoices")} />
                ) : (
                  invoices.map((inv) => (
                    <li key={inv.id}>
                      <button
                        type="button"
                        onClick={() => setSelected(inv)}
                        className="w-full text-left"
                      >
                        <BuyerCard
                          hover
                          className="flex flex-wrap items-center justify-between gap-3 p-4"
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
                        </BuyerCard>
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
              loading={payMutation.isPending}
              onClick={() => payMutation.mutate(selected)}
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
