"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api/client";
import Modal from "@/components/modals/Modal";
import Button from "@/components/ui/Button";
import { Alert, EmptyState, Field, PageHeader, TabBar, fieldClass } from "@/components/app/ui";

type Tab = "coa" | "journals" | "tb" | "pl" | "bs" | "gl" | "ar" | "ap";

type Account = { id: string; code: string; name: string; type: string };
type Journal = {
  id: string;
  date: string;
  description: string;
  source_type: string;
  is_locked: boolean;
  lines: {
    account_id: string;
    account_code?: string;
    account_name?: string;
    debit: string;
    credit: string;
    memo?: string;
  }[];
};
type TbRow = { code: string; name: string; type: string; debit: string; credit: string };
type PlData = {
  lines: { code: string; name: string; type: string; amount: string }[];
  total_revenue: string;
  total_expense: string;
  net_income: string;
};
type BsData = {
  lines: { code: string; name: string; type: string; balance: string }[];
  total_assets: string;
  total_liabilities: string;
  total_equity: string;
};
type GlRow = {
  date: string;
  description: string;
  debit: string;
  credit: string;
  balance: string;
};
type AgingRow = {
  id: string;
  balance_due: string;
  bucket: string;
  customer_name?: string;
  supplier_name?: string;
  invoice_number?: string;
  bill_number?: string;
};

export default function AccountingPage() {
  const [tab, setTab] = useState<Tab>("tb");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [journals, setJournals] = useState<Journal[]>([]);
  const [tb, setTb] = useState<TbRow[]>([]);
  const [pl, setPl] = useState<PlData | null>(null);
  const [bs, setBs] = useState<BsData | null>(null);
  const [gl, setGl] = useState<GlRow[]>([]);
  const [glAccountId, setGlAccountId] = useState("");
  const [arAging, setArAging] = useState<AgingRow[]>([]);
  const [apAging, setApAging] = useState<AgingRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [jeModal, setJeModal] = useState(false);
  const [busy, setBusy] = useState(false);

  const [jeDesc, setJeDesc] = useState("");
  const [lineA, setLineA] = useState({ account_id: "", debit: "", credit: "" });
  const [lineB, setLineB] = useState({ account_id: "", debit: "", credit: "" });

  const [from, setFrom] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-01-01`;
  });
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));

  const loadCore = useCallback(async () => {
    setError(null);
    try {
      const [acc, je] = await Promise.all([
        api<{ data: Account[] }>("/accounts").catch(() => ({ data: [] as Account[] })),
        api<{ data: Journal[] }>("/journals").catch(() => ({ data: [] as Journal[] })),
      ]);
      setAccounts(acc.data || []);
      setJournals(je.data || []);
      if (!glAccountId && acc.data?.[0]) setGlAccountId(acc.data[0].id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    }
  }, [glAccountId]);

  useEffect(() => {
    loadCore();
  }, [loadCore]);

  async function loadTb() {
    try {
      const res = await api<{ data: TbRow[] }>(
        `/reports/trial-balance?from=${from}&to=${to}`
      );
      setTb(res.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "TB failed");
    }
  }

  async function loadPl() {
    try {
      const res = await api<{ data: PlData }>(
        `/reports/profit-and-loss?from=${from}&to=${to}`
      );
      setPl(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "P&L failed");
    }
  }

  async function loadBs() {
    try {
      const res = await api<{ data: BsData }>(`/reports/balance-sheet?as_of=${to}`);
      setBs(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "BS failed");
    }
  }

  async function loadGl() {
    if (!glAccountId) return;
    try {
      const res = await api<{ data: GlRow[] }>(
        `/reports/general-ledger?account_id=${glAccountId}&from=${from}&to=${to}`
      );
      setGl(res.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "GL failed");
    }
  }

  async function loadAging() {
    try {
      const [ar, ap] = await Promise.all([
        api<{ data: AgingRow[] }>("/ar/aging"),
        api<{ data: AgingRow[] }>("/ap/aging"),
      ]);
      setArAging(ar.data || []);
      setApAging(ap.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Aging failed");
    }
  }

  useEffect(() => {
    if (tab === "tb") loadTb();
    if (tab === "pl") loadPl();
    if (tab === "bs") loadBs();
    if (tab === "gl") loadGl();
    if (tab === "ar" || tab === "ap") loadAging();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, from, to, glAccountId]);

  async function createJournal(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/journals", {
        method: "POST",
        body: JSON.stringify({
          description: jeDesc,
          date: to,
          lines: [
            {
              account_id: lineA.account_id,
              debit: lineA.debit || "0",
              credit: lineA.credit || "0",
            },
            {
              account_id: lineB.account_id,
              debit: lineB.debit || "0",
              credit: lineB.credit || "0",
            },
          ],
        }),
      });
      setMessage("Journal posted");
      setJeDesc("");
      setLineA({ account_id: "", debit: "", credit: "" });
      setLineB({ account_id: "", debit: "", credit: "" });
      setJeModal(false);
      await loadCore();
      setTab("journals");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Journal failed");
    } finally {
      setBusy(false);
    }
  }

  async function reverseJournal(id: string) {
    try {
      await api(`/journals/${id}/reverse`, { method: "POST", body: "{}" });
      setMessage("Reversal posted");
      await loadCore();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reverse failed");
    }
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "tb", label: "Trial balance" },
    { id: "pl", label: "P&L" },
    { id: "bs", label: "Balance sheet" },
    { id: "gl", label: "General ledger" },
    { id: "journals", label: "Journals" },
    { id: "coa", label: "Chart of accounts" },
    { id: "ar", label: "AR aging" },
    { id: "ap", label: "AP aging" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Books"
        title="Accounting"
        description="Chart of accounts, journals, statements, and AR/AP aging."
        action={
          tab === "journals"
            ? { label: "Post journal", onClick: () => setJeModal(true) }
            : undefined
        }
      />

      {error ? <Alert tone="error">{error}</Alert> : null}
      {message ? <Alert>{message}</Alert> : null}

      <TabBar tabs={tabs} value={tab} onChange={setTab} />

      {["tb", "pl", "bs", "gl"].includes(tab) ? (
        <div className="flex flex-wrap gap-3">
          <label className="text-sm text-heading">
            From{" "}
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="ml-1 rounded border border-border px-2 py-1"
            />
          </label>
          <label className="text-sm text-heading">
            To{" "}
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="ml-1 rounded border border-border px-2 py-1"
            />
          </label>
          {tab === "gl" ? (
            <select
              value={glAccountId}
              onChange={(e) => setGlAccountId(e.target.value)}
              className="rounded border border-border px-2 py-1 text-sm"
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.code} · {a.name}
                </option>
              ))}
            </select>
          ) : null}
        </div>
      ) : null}

      {tab === "coa" ? (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-left text-sm">
            <thead className="bg-brand-subtle">
              <tr>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Type</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((a) => (
                <tr key={a.id} className="border-t border-border text-heading">
                  <td className="px-4 py-2">{a.code}</td>
                  <td className="px-4 py-2">{a.name}</td>
                  <td className="px-4 py-2">{a.type}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {tab === "journals" ? (
        <div className="space-y-4">
          {journals.length === 0 ? (
            <EmptyState
              title="No journals yet"
              body="Post a manual journal or wait for POS/inventory postings."
            />
          ) : null}
          <div className="space-y-3">
            {journals.map((j) => (
              <div key={j.id} className="rounded-xl border border-border bg-card p-4 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-heading">
                    <strong>{j.date}</strong> · {j.description}{" "}
                    <span className="text-body">({j.source_type})</span>
                  </div>
                  {j.is_locked && j.source_type !== "reversal" ? (
                    <button
                      type="button"
                      onClick={() => reverseJournal(j.id)}
                      className="rounded border border-border px-3 py-1"
                    >
                      Reverse
                    </button>
                  ) : null}
                </div>
                <ul className="mt-2 space-y-1 text-body">
                  {j.lines?.map((l, i) => (
                    <li key={i}>
                      {l.account_code || l.account_id.slice(0, 8)} · Dr {l.debit} / Cr{" "}
                      {l.credit}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {tab === "tb" ? (
        <StatementTable
          headers={["Code", "Account", "Debit", "Credit"]}
          rows={tb.map((r) => [r.code, r.name, r.debit, r.credit])}
        />
      ) : null}

      {tab === "pl" && pl ? (
        <div className="space-y-3">
          <StatementTable
            headers={["Code", "Account", "Type", "Amount"]}
            rows={pl.lines.map((r) => [r.code, r.name, r.type, r.amount])}
          />
          <p className="text-heading">
            Revenue {pl.total_revenue} − Expense {pl.total_expense} ={" "}
            <strong>Net {pl.net_income}</strong>
          </p>
        </div>
      ) : null}

      {tab === "bs" && bs ? (
        <div className="space-y-3">
          <StatementTable
            headers={["Code", "Account", "Type", "Balance"]}
            rows={bs.lines.map((r) => [r.code, r.name, r.type, r.balance])}
          />
          <p className="text-sm text-heading">
            Assets {bs.total_assets} · Liabilities {bs.total_liabilities} · Equity{" "}
            {bs.total_equity}
          </p>
        </div>
      ) : null}

      {tab === "gl" ? (
        <StatementTable
          headers={["Date", "Description", "Debit", "Credit", "Balance"]}
          rows={gl.map((r) => [r.date, r.description, r.debit, r.credit, r.balance])}
        />
      ) : null}

      {tab === "ar" ? (
        <StatementTable
          headers={["Invoice", "Customer", "Balance", "Bucket"]}
          rows={arAging.map((r) => [
            r.invoice_number || r.id.slice(0, 8),
            r.customer_name || "—",
            r.balance_due,
            r.bucket,
          ])}
        />
      ) : null}

      {tab === "ap" ? (
        <StatementTable
          headers={["Bill", "Supplier", "Balance", "Bucket"]}
          rows={apAging.map((r) => [
            r.bill_number || r.id.slice(0, 8),
            r.supplier_name || "—",
            r.balance_due,
            r.bucket,
          ])}
        />
      ) : null}

      <Modal
        isOpen={jeModal}
        onClose={() => setJeModal(false)}
        title="Post journal"
        description="Enter a balanced two-line manual journal entry."
        footer={
          <>
            <Button variant="outline" onClick={() => setJeModal(false)}>
              Cancel
            </Button>
            <Button type="submit" form="je-modal-form" loading={busy}>
              Post journal
            </Button>
          </>
        }
      >
        <form id="je-modal-form" onSubmit={createJournal} className="space-y-4">
          <Field label="Description">
            <input
              className={fieldClass}
              placeholder="Description"
              value={jeDesc}
              onChange={(e) => setJeDesc(e.target.value)}
              required
            />
          </Field>
          {([lineA, lineB] as const).map((line, idx) => (
            <div key={idx} className="grid gap-2 md:grid-cols-3">
              <select
                className={fieldClass}
                value={line.account_id}
                onChange={(e) =>
                  idx === 0
                    ? setLineA({ ...lineA, account_id: e.target.value })
                    : setLineB({ ...lineB, account_id: e.target.value })
                }
                required
              >
                <option value="">Account</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.code} {a.name}
                  </option>
                ))}
              </select>
              <input
                className={fieldClass}
                placeholder="Debit"
                value={line.debit}
                onChange={(e) =>
                  idx === 0
                    ? setLineA({ ...lineA, debit: e.target.value })
                    : setLineB({ ...lineB, debit: e.target.value })
                }
              />
              <input
                className={fieldClass}
                placeholder="Credit"
                value={line.credit}
                onChange={(e) =>
                  idx === 0
                    ? setLineA({ ...lineA, credit: e.target.value })
                    : setLineB({ ...lineB, credit: e.target.value })
                }
              />
            </div>
          ))}
        </form>
      </Modal>
    </div>
  );
}

function StatementTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: (string | undefined)[][];
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <table className="w-full text-left text-sm">
        <thead className="bg-brand-subtle">
          <tr>
            {headers.map((h) => (
              <th key={h} className="px-4 py-3">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td className="px-4 py-3 text-body" colSpan={headers.length}>
                No rows
              </td>
            </tr>
          ) : (
            rows.map((row, i) => (
              <tr key={i} className="border-t border-border text-heading">
                {row.map((cell, j) => (
                  <td key={j} className="px-4 py-2">
                    {cell}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
