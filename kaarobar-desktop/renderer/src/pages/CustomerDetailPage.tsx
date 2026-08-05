import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Wallet } from "lucide-react";
import { api } from "@/lib/api/client";
import { routes } from "@/lib/navigation";
import { DetailFieldGrid, DetailSection, DetailShell } from "@/components/app/DetailShell";
import ProfilePicEditor from "@/components/app/ProfilePicEditor";
import type { Customer } from "@/lib/customers";
import { formatDecimal } from "@/lib/decimal";
import { useT } from "@/lib/i18n";
import { useToast } from "@/components/ui/Toast";
import Button from "@/components/ui/Button";
import ReceiveArPaymentFormModal, {
  type OpenArInvoice,
} from "@/components/customers/ReceiveArPaymentFormModal";

type LedgerEntry = {
  kind: string;
  date: string;
  reference: string;
  description: string;
  debit: string;
  credit: string;
};

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const t = useT();
  const toast = useToast();
  const [customer, setCustomer] = useState<(Customer & { balance?: string }) | null>(null);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [openInvoices, setOpenInvoices] = useState<OpenArInvoice[]>([]);
  const [payOpen, setPayOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [c, l, ar] = await Promise.all([
        api<{ data: Customer & { balance?: string } }>(`/customers/${id}`),
        api<{ data: { entries: LedgerEntry[]; balance: string } }>(`/customers/${id}/ledger`),
        api<{ data: OpenArInvoice[] }>(
          `/ar/invoices?customer_id=${encodeURIComponent(id)}&open_only=true&limit=100`
        ).catch(() => ({ data: [] as OpenArInvoice[] })),
      ]);
      setCustomer(c.data);
      setLedger(l.data.entries || []);
      setOpenInvoices(ar.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [id, t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleReceivePayment(payload: {
    invoiceId: string;
    amount: string;
    method: string;
    reference: string;
  }) {
    setBusy(true);
    try {
      await api(`/ar/invoices/${payload.invoiceId}/pay`, {
        method: "POST",
        body: JSON.stringify({
          amount: payload.amount,
          method: payload.method,
          reference: payload.reference || undefined,
        }),
      });
      toast.success(t("customers.paymentReceived"));
      setPayOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  const canPay = Number(customer?.balance || 0) > 0;

  return (
    <DetailShell
      backHref={routes.customers}
      backLabel={t("common.back")}
      eyebrow={t("nav.customers")}
      title={customer?.name || t("nav.customers")}
      subtitle={customer?.company_name || customer?.email || customer?.phone || undefined}
      status={
        customer?.credit_enabled
          ? { label: t("listFilters.khataOn"), tone: "success" }
          : { label: t("listFilters.khataOff"), tone: "info" }
      }
      loading={loading}
      error={error}
      actions={
        canPay ? (
          <Button
            size="sm"
            startIcon={<Wallet className="h-4 w-4" />}
            onClick={() => setPayOpen(true)}
          >
            {t("customers.receivePayment")}
          </Button>
        ) : null
      }
    >
      {customer ? (
        <>
          <DetailSection title={t("common.profile")}>
            <div className="mb-4">
              <ProfilePicEditor
                url={customer.profile_pic_url}
                name={customer.name}
                uploadPath={`/customers/${customer.id}/profile-pic`}
                urlFromResponse={(body) =>
                  (body as { data?: Customer })?.data?.profile_pic_url
                }
                onChange={(next) =>
                  setCustomer((c) => (c ? { ...c, profile_pic_url: next } : c))
                }
              />
            </div>
            <DetailFieldGrid
              fields={[
                { label: t("customers.phone"), value: customer.phone || "—" },
                { label: t("customers.email"), value: customer.email || "—" },
                { label: t("customers.cnic"), value: customer.cnic || "—" },
                { label: t("customers.ntn"), value: customer.ntn || "—" },
                { label: t("customers.address"), value: customer.address || "—" },
                {
                  label: t("customers.khataEnabled"),
                  value: customer.credit_enabled
                    ? t("customers.khataOn")
                    : t("customers.khataOff"),
                },
                {
                  label: t("customers.creditLimit"),
                  value: customer.credit_limit
                    ? `Rs ${formatDecimal(customer.credit_limit)}`
                    : "—",
                },
                {
                  label: t("customers.points"),
                  value: String(customer.loyalty_points ?? 0),
                },
                {
                  label: t("customers.balance"),
                  value: customer.balance
                    ? `Rs ${formatDecimal(customer.balance)}`
                    : "—",
                },
                {
                  label: t("customers.optInEmail"),
                  value: customer.marketing_opt_in_email
                    ? t("common.yes")
                    : t("common.no"),
                },
              ]}
            />
            {customer.notes ? (
              <p className="mt-4 rounded-md bg-bg-tertiary px-3 py-2 text-sm text-body">
                {customer.notes}
              </p>
            ) : null}
          </DetailSection>

          <DetailSection title={t("customers.ledger")}>
            <div className="overflow-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-muted">
                    <th className="py-2 pr-2">{t("common.date")}</th>
                    <th className="py-2 pr-2">{t("customers.ref")}</th>
                    <th className="py-2 pr-2">{t("customers.description")}</th>
                    <th className="py-2 pr-2 text-right">{t("customers.debit")}</th>
                    <th className="py-2 text-right">{t("customers.credit")}</th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.map((e, i) => (
                    <tr key={`${e.reference}-${i}`} className="border-b border-border/50">
                      <td className="whitespace-nowrap py-2 pr-2">{e.date}</td>
                      <td className="py-2 pr-2 font-mono text-xs">{e.reference}</td>
                      <td className="py-2 pr-2">{e.description}</td>
                      <td className="py-2 pr-2 text-right tabular-nums">
                        {formatDecimal(e.debit)}
                      </td>
                      <td className="py-2 text-right tabular-nums">
                        {formatDecimal(e.credit)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {ledger.length === 0 ? (
                <p className="py-4 text-sm text-body">{t("customers.noLedgerBody")}</p>
              ) : null}
            </div>
          </DetailSection>
        </>
      ) : null}

      <ReceiveArPaymentFormModal
        isOpen={payOpen}
        busy={busy}
        invoices={openInvoices}
        t={t}
        onClose={() => setPayOpen(false)}
        onSubmit={handleReceivePayment}
      />
    </DetailShell>
  );
}
