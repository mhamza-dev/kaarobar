"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Megaphone, UserPlus } from "lucide-react";
import { api, isConsumerSession } from "@/lib/api/client";
import Button from "@/components/ui/Button";
import DataTable from "@/components/ui/DataTable";
import ActionMenu from "@/components/ui/ActionMenu";
import {
  EmptyState,
  Field,
  SurfaceCard,
  fieldClass,
} from "@/components/app/ui";
import { useToast } from "@/components/ui/Toast";
import { useT } from "@/lib/i18n";
import { formatDecimal } from "@/lib/decimal";
import { detailRoutes } from "@/lib/navigation";
import {
  type Customer,
  type CustomerForm,
  customerPayload,
  customerSearchText,
  customerToForm,
  emptyCustomerForm,
} from "@/lib/customers";
import {
  emptyStaffListFilters,
  type ListFilterConfig,
  type StaffListFilterState,
} from "@/lib/listFilters";
import BuyerLoyalty from "@/components/buyer/BuyerLoyalty";
import WorkspacePageScaffold from "@/components/app/WorkspacePageScaffold";
import {
  CustomerFormModal,
  LoyaltyAdjustmentModal,
} from "@/components/customers/CustomerModals";

type LedgerEntry = {
  kind: string;
  date: string;
  reference: string;
  description: string;
  debit: string;
  credit: string;
};

export default function CustomersPage() {
  if (isConsumerSession()) {
    return <BuyerLoyalty />;
  }

  return <StaffCustomersPage />;
}

function StaffCustomersPage() {
  const t = useT();
  const toast = useToast();
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<StaffListFilterState>(emptyStaffListFilters());
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState<"create" | "edit" | "loyalty" | null>(null);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState<CustomerForm>(emptyCustomerForm());
  const [loyaltyDelta, setLoyaltyDelta] = useState("10");
  const [loyaltyReason, setLoyaltyReason] = useState("");
  const [ledgerCustomer, setLedgerCustomer] = useState<Customer | null>(null);
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [ledgerBalance, setLedgerBalance] = useState("0");
  const [payAmount, setPayAmount] = useState("");
  const [payInvoiceId, setPayInvoiceId] = useState("");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api<{ data: Customer[] }>("/customers");
      setCustomers(res.data || []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const filterConfig = useMemo<ListFilterConfig>(
    () => ({
      showDateRange: false,
      showBalanceRange: true,
      showCreditLimitRange: true,
      statusOptions: [
        { value: "khata_on", label: t("listFilters.khataOn") },
        { value: "khata_off", label: t("listFilters.khataOff") },
      ],
    }),
    [t]
  );

  function openCreate() {
    setEditing(null);
    setForm(emptyCustomerForm());
    setModal("create");
  }

  function openEdit(c: Customer) {
    setEditing(c);
    setForm(customerToForm(c));
    setModal("edit");
  }

  function openLoyalty(c: Customer) {
    setEditing(c);
    setLoyaltyDelta("10");
    setLoyaltyReason("");
    setModal("loyalty");
  }

  async function saveCustomer(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const body = customerPayload(form);
      if (editing) {
        await api(`/customers/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
      } else {
        await api("/customers", { method: "POST", body: JSON.stringify(body) });
      }
      toast.success(t("common.success"));
      setModal(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  async function toggleKhata(c: Customer) {
    try {
      await api(`/customers/${c.id}`, {
        method: "PATCH",
        body: JSON.stringify({ khata_enabled: !c.khata_enabled }),
      });
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    }
  }

  async function adjustLoyalty(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setBusy(true);
    try {
      await api(`/customers/${editing.id}/loyalty`, {
        method: "POST",
        body: JSON.stringify({
          delta: Number(loyaltyDelta),
          reason: loyaltyReason || undefined,
        }),
      });
      toast.success(t("common.success"));
      setModal(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  async function openLedger(c: Customer) {
    try {
      const [ledgerRes, arRes] = await Promise.all([
        api<{
          data: { balance: string; entries: LedgerEntry[]; customer: Customer };
        }>(`/customers/${c.id}/ledger`),
        api<{
          data: {
            id: string;
            customer_id?: string;
            balance_due: string;
            status: string;
          }[];
        }>("/ar/invoices").catch(() => ({ data: [] })),
      ]);
      setLedgerCustomer({ ...c, ...ledgerRes.data.customer, balance: ledgerRes.data.balance });
      setLedgerEntries(ledgerRes.data.entries || []);
      setLedgerBalance(ledgerRes.data.balance || "0");
      const openInv = (arRes.data || []).find(
        (inv) =>
          inv.customer_id === c.id &&
          Number(inv.balance_due) > 0 &&
          (inv.status === "open" || inv.status === "partial")
      );
      setPayInvoiceId(openInv?.id || "");
      setPayAmount(openInv?.balance_due || "");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    }
  }

  async function receivePayment() {
    if (!payInvoiceId || !payAmount) {
      toast.error(t("customers.paymentRequired"));
      return;
    }
    setBusy(true);
    try {
      await api(`/ar/invoices/${payInvoiceId}/pay`, {
        method: "POST",
        body: JSON.stringify({ amount: payAmount }),
      });
      toast.success(t("common.success"));
      if (ledgerCustomer) await openLedger(ledgerCustomer);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <WorkspacePageScaffold
      header={{
        eyebrow: t("customers.eyebrow"),
        title: t("pages.customersTitle"),
        description: t("pages.customersDesc"),
        infoKey: "page.customers",
        action: {
          label: t("customers.add"),
          onClick: openCreate,
          icon: <UserPlus className="h-4 w-4" />,
        },
        secondaryAction: {
          label: t("nav.marketing"),
          onClick: () => {
            window.location.href = "/app/marketing";
          },
          icon: <Megaphone className="h-4 w-4" />,
        },
      }}
    >

      <p className="text-sm text-body">
        {t("customers.hint")}{" "}
        <Link href="/app/marketing" className="text-brand underline">
          {t("nav.marketing")}
        </Link>
        .
      </p>

      <DataTable
        maxHeight="28rem"
        loading={loading}
        filterState={filters}
        onFilterChange={setFilters}
        filterConfig={filterConfig}
        filterAccessors={{
          searchText: customerSearchText,
          status: (c) => (c.khata_enabled ? "khata_on" : "khata_off"),
          balance: (c) => c.balance,
          creditLimit: (c) => c.credit_limit,
        }}
        clientFilter
        searchPlaceholder={t("customers.search")}
        pagination={{ mode: "client", pageSize: 25 }}
        exportable
        exportFilename="customers"
        exportTitle={t("pages.customersTitle")}
        getExportRow={(c) => ({
          name: c.name,
          company: c.company_name || "",
          phone: c.phone || "",
          cnic: c.cnic || "",
          khata: c.khata_enabled ? "on" : "off",
          balance: c.balance || "0",
          credit: c.credit_limit || "",
          points: String(c.loyalty_points ?? 0),
        })}
        exportColumns={[
          { key: "name", header: t("common.name") },
          { key: "company", header: t("customers.company") },
          { key: "phone", header: t("customers.phone") },
          { key: "cnic", header: t("customers.cnic") },
          { key: "khata", header: t("customers.khata") },
          { key: "balance", header: t("customers.balance") },
          { key: "credit", header: t("customers.creditLimit") },
          { key: "points", header: t("customers.points") },
        ]}
        columns={[
          {
            id: "name",
            header: t("common.name"),
            cell: (c) => (
              <Link href={detailRoutes.customer(c.id)} className="font-semibold text-brand underline">
                {c.name}
              </Link>
            ),
          },
          { id: "company", header: t("customers.company"), cell: (c) => c.company_name || "—" },
          { id: "phone", header: t("customers.phone"), cell: (c) => c.phone || "—" },
          { id: "cnic", header: t("customers.cnic"), cell: (c) => c.cnic || "—" },
          {
            id: "khata",
            header: t("customers.khata"),
            cell: (c) => (c.khata_enabled ? t("customers.khataOn") : t("customers.khataOff")),
          },
          { id: "balance", header: t("customers.balance"), cell: (c) => formatDecimal(c.balance || "0") },
          {
            id: "credit",
            header: t("customers.creditLimit"),
            cell: (c) =>
              c.credit_limit != null && c.credit_limit !== ""
                ? formatDecimal(c.credit_limit)
                : "—",
          },
          {
            id: "points",
            header: t("customers.points"),
            cell: (c) => String(c.loyalty_points ?? 0),
          },
          {
            id: "actions",
            header: "",
            align: "right",
            width: 120,
            cell: (c) => (
              <div className="flex justify-end">
                <ActionMenu
                  items={[
                    {
                      id: "ledger",
                      label: t("customers.ledger"),
                      onClick: () => void openLedger(c),
                    },
                    {
                      id: "khata",
                      label: c.khata_enabled
                        ? t("customers.disableKhata")
                        : t("customers.enableKhata"),
                      onClick: () => void toggleKhata(c),
                    },
                    {
                      id: "points",
                      label: t("customers.points"),
                      onClick: () => openLoyalty(c),
                    },
                  ]}
                />
              </div>
            ),
          },
        ]}
        data={customers}
        rowKey={(c) => c.id}
        onRowClick={(c) => router.push(detailRoutes.customer(c.id))}
        emptyTitle={t("customers.emptyTitle")}
        emptyBody={t("customers.emptyBody")}
      />

      {ledgerCustomer ? (
        <SurfaceCard className="space-y-3 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-semibold text-heading">
                {t("customers.ledgerTitle", { name: ledgerCustomer.name })}
              </h3>
              <p className="text-sm text-body">
                {t("customers.balanceDue", { amount: formatDecimal(ledgerBalance) })}
              </p>
            </div>
            <Button size="sm" variant="secondary" onClick={() => setLedgerCustomer(null)}>
              {t("common.close")}
            </Button>
          </div>
          {Number(ledgerBalance) > 0 ? (
            <div className="flex flex-wrap items-end gap-2">
              <Field label={t("customers.invoiceId")}>
                <input
                  className={fieldClass}
                  value={payInvoiceId}
                  onChange={(e) => setPayInvoiceId(e.target.value)}
                  placeholder={t("customers.invoicePlaceholder")}
                />
              </Field>
              <Field label={t("common.amount")}>
                <input
                  className={fieldClass}
                  type="number"
                  step="0.01"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  onBlur={(e) => {
                    if (e.target.value.trim() === "") return;
                    setPayAmount(formatDecimal(e.target.value));
                  }}
                />
              </Field>
              <Button size="sm" loading={busy} onClick={() => void receivePayment()}>
                {t("customers.receivePayment")}
              </Button>
            </div>
          ) : null}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-body">
                  <th className="py-1">{t("common.date")}</th>
                  <th className="py-1">{t("customers.kind")}</th>
                  <th className="py-1">{t("customers.ref")}</th>
                  <th className="py-1">{t("customers.description")}</th>
                  <th className="py-1">{t("customers.debit")}</th>
                  <th className="py-1">{t("customers.credit")}</th>
                </tr>
              </thead>
              <tbody>
                {ledgerEntries.map((e, i) => (
                  <tr key={`${e.reference}-${i}`} className="border-t border-border text-heading">
                    <td className="py-2">{e.date}</td>
                    <td className="py-2">{e.kind}</td>
                    <td className="py-2">{e.reference}</td>
                    <td className="py-2">{e.description}</td>
                    <td className="py-2 tabular-nums">{formatDecimal(e.debit)}</td>
                    <td className="py-2 tabular-nums">{formatDecimal(e.credit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {ledgerEntries.length === 0 ? (
              <EmptyState
                title={t("customers.noLedgerTitle")}
                body={t("customers.noLedgerBody")}
              />
            ) : null}
          </div>
        </SurfaceCard>
      ) : null}

      <CustomerFormModal
        isOpen={modal === "create" || modal === "edit"}
        busy={busy}
        editing={editing}
        form={form}
        setForm={setForm}
        t={t}
        onClose={() => setModal(null)}
        onSubmit={saveCustomer}
      />

      <LoyaltyAdjustmentModal
        isOpen={modal === "loyalty"}
        busy={busy}
        customerName={editing?.name || ""}
        currentPoints={editing?.loyalty_points ?? 0}
        loyaltyDelta={loyaltyDelta}
        loyaltyReason={loyaltyReason}
        setLoyaltyDelta={setLoyaltyDelta}
        setLoyaltyReason={setLoyaltyReason}
        t={t}
        onClose={() => setModal(null)}
        onSubmit={adjustLoyalty}
      />
    </WorkspacePageScaffold>
  );
}
