
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api/client";
import Modal from "@/components/modals/Modal";
import Button from "@/components/ui/Button";
import DataTable from "@/components/ui/DataTable";
import {
  EmptyState,
  Field,
  PageHeader,
  SurfaceCard,
  fieldClass,
} from "@/components/app/ui";
import { useToast } from "@/components/ui/Toast";
import { useT } from "@/lib/i18n";
import {
  type Customer,
  type CustomerForm,
  CUSTOMER_FORM_FIELDS,
  customerPayload,
  customerSearchText,
  customerToForm,
  emptyCustomerForm,
} from "@/lib/customers";

type LedgerEntry = {
  kind: string;
  date: string;
  reference: string;
  description: string;
  debit: string;
  credit: string;
};

export default function CustomersPage() {
  const t = useT();
  const toast = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
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
      const res = await api<{ data: Customer[] }>("/customers");
      setCustomers(res.data || []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.loadFailed"));
    }
  }, [t, toast]);

  useEffect(() => {
    void load();
  }, [load]);

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
    <div className="space-y-6">
      <PageHeader
        eyebrow={t("customers.eyebrow")}
        title={t("pages.customersTitle")}
        description={t("pages.customersDesc")}
        action={{ label: t("customers.add"), onClick: openCreate }}
        secondaryAction={{
          label: t("nav.marketing"),
          onClick: () => {
            window.location.hash = "#/app/marketing";
          },
        }}
      />

      <p className="text-sm text-body">
        {t("customers.hint")}{" "}
        <Link to="/app/marketing" className="text-brand underline">
          {t("nav.marketing")}
        </Link>
        .
      </p>

      <DataTable
        maxHeight="28rem"
        searchable
        searchPlaceholder={t("customers.search")}
        getSearchText={customerSearchText}
        columns={[
          { id: "name", header: t("common.name"), cell: (c) => c.name },
          { id: "company", header: t("customers.company"), cell: (c) => c.company_name || "—" },
          { id: "phone", header: t("customers.phone"), cell: (c) => c.phone || "—" },
          { id: "cnic", header: t("customers.cnic"), cell: (c) => c.cnic || "—" },
          {
            id: "khata",
            header: t("customers.khata"),
            cell: (c) => (c.khata_enabled ? t("customers.khataOn") : t("customers.khataOff")),
          },
          { id: "balance", header: t("customers.balance"), cell: (c) => c.balance || "0" },
          {
            id: "credit",
            header: t("customers.creditLimit"),
            cell: (c) => c.credit_limit || "—",
          },
          {
            id: "points",
            header: t("customers.points"),
            cell: (c) => String(c.loyalty_points ?? 0),
          },
          {
            id: "actions",
            header: "",
            cell: (c) => (
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" onClick={() => openEdit(c)}>
                  {t("common.edit")}
                </Button>
                <Button size="sm" variant="outline" onClick={() => void openLedger(c)}>
                  {t("customers.ledger")}
                </Button>
                <Button size="sm" variant="outline" onClick={() => void toggleKhata(c)}>
                  {c.khata_enabled ? t("customers.disableKhata") : t("customers.enableKhata")}
                </Button>
                <Button size="sm" variant="outline" onClick={() => openLoyalty(c)}>
                  {t("customers.points")}
                </Button>
              </div>
            ),
          },
        ]}
        data={customers}
        rowKey={(c) => c.id}
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
                {t("customers.balanceDue", { amount: ledgerBalance })}
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
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
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
                    <td className="py-2">{e.debit}</td>
                    <td className="py-2">{e.credit}</td>
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

      <Modal
        isOpen={modal === "create" || modal === "edit"}
        onClose={() => setModal(null)}
        title={editing ? t("customers.edit") : t("customers.add")}
        footer={
          <Button type="submit" form="customer-form" loading={busy}>
            {editing ? t("common.save") : t("common.create")}
          </Button>
        }
      >
        <form id="customer-form" onSubmit={saveCustomer} className="grid gap-3 sm:grid-cols-2">
          {CUSTOMER_FORM_FIELDS.map((f) =>
            f.type === "checkbox" ? (
              <label key={f.key} className="flex items-center gap-2 text-sm text-heading sm:col-span-2">
                <input
                  type="checkbox"
                  checked={form.khata_enabled}
                  onChange={(e) => setForm({ ...form, khata_enabled: e.target.checked })}
                />
                {t(f.labelKey)}
              </label>
            ) : f.type === "textarea" ? (
              <Field key={f.key} label={t(f.labelKey)}>
                <textarea
                  className={fieldClass}
                  rows={3}
                  value={String(form[f.key] ?? "")}
                  onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                />
              </Field>
            ) : (
              <Field key={f.key} label={t(f.labelKey)}>
                <input
                  className={fieldClass}
                  type={f.type || "text"}
                  required={f.required}
                  value={String(form[f.key] ?? "")}
                  onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                />
              </Field>
            )
          )}
        </form>
      </Modal>

      <Modal
        isOpen={modal === "loyalty"}
        onClose={() => setModal(null)}
        title={t("customers.adjustPointsTitle", { name: editing?.name || "" })}
        footer={
          <Button type="submit" form="loyalty-form" loading={busy}>
            {t("customers.apply")}
          </Button>
        }
      >
        <form id="loyalty-form" onSubmit={adjustLoyalty} className="grid gap-3">
          <p className="text-sm text-body">
            {t("customers.currentPoints", { count: editing?.loyalty_points ?? 0 })}
          </p>
          <Field label={t("customers.delta")}>
            <input
              className={fieldClass}
              value={loyaltyDelta}
              onChange={(e) => setLoyaltyDelta(e.target.value)}
              required
            />
          </Field>
          <Field label={t("customers.reason")}>
            <input
              className={fieldClass}
              value={loyaltyReason}
              onChange={(e) => setLoyaltyReason(e.target.value)}
            />
          </Field>
        </form>
      </Modal>
    </div>
  );
}
