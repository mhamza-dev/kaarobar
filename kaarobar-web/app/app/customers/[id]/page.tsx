"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api/client";
import { routes } from "@/lib/navigation";
import { DetailFieldGrid, DetailSection, DetailShell } from "@/components/app/DetailShell";
import type { Customer } from "@/lib/customers";

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
  const [customer, setCustomer] = useState<(Customer & { balance?: string }) | null>(null);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [c, l] = await Promise.all([
        api<{ data: Customer & { balance?: string } }>(`/customers/${id}`),
        api<{ data: { entries: LedgerEntry[]; balance: string } }>(`/customers/${id}/ledger`),
      ]);
      setCustomer(c.data);
      setLedger(l.data.entries || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load customer");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <DetailShell
      backHref={routes.customers}
      backLabel="Back to customers"
      eyebrow="Customer"
      title={customer?.name || "Customer"}
      subtitle={customer?.company_name || customer?.email || customer?.phone || undefined}
      status={
        customer?.khata_enabled
          ? { label: "Khata on", tone: "success" }
          : { label: "Khata off", tone: "info" }
      }
      loading={loading}
      error={error}
    >
      {customer ? (
        <>
          <DetailSection title="Profile">
            <DetailFieldGrid
              fields={[
                { label: "Phone", value: customer.phone || "—" },
                { label: "Email", value: customer.email || "—" },
                { label: "CNIC", value: customer.cnic || "—" },
                { label: "NTN", value: customer.ntn || "—" },
                { label: "Address", value: customer.address || "—" },
                { label: "Loyalty points", value: String(customer.loyalty_points ?? 0) },
                { label: "Balance", value: customer.balance ? `Rs ${customer.balance}` : "—" },
                {
                  label: "Email opt-in",
                  value: customer.marketing_opt_in_email ? "Yes" : "No",
                },
              ]}
            />
            {customer.notes ? (
              <p className="mt-4 rounded-md bg-bg-tertiary px-3 py-2 text-sm text-body">
                {customer.notes}
              </p>
            ) : null}
          </DetailSection>

          <DetailSection title="Ledger" description="Sales, payments, and adjustments.">
            <div className="overflow-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-muted">
                    <th className="py-2 pr-2">Date</th>
                    <th className="py-2 pr-2">Ref</th>
                    <th className="py-2 pr-2">Description</th>
                    <th className="py-2 pr-2 text-right">Debit</th>
                    <th className="py-2 text-right">Credit</th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.map((e, i) => (
                    <tr key={`${e.reference}-${i}`} className="border-b border-border/60">
                      <td className="py-2 pr-2 text-body">{String(e.date).slice(0, 10)}</td>
                      <td className="py-2 pr-2 font-medium text-heading">{e.reference}</td>
                      <td className="py-2 pr-2 text-body">{e.description}</td>
                      <td className="py-2 pr-2 text-right tabular-nums">{e.debit}</td>
                      <td className="py-2 text-right tabular-nums">{e.credit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {ledger.length === 0 ? (
                <p className="py-6 text-center text-sm text-body">No ledger entries yet.</p>
              ) : null}
            </div>
          </DetailSection>
        </>
      ) : null}
    </DetailShell>
  );
}
