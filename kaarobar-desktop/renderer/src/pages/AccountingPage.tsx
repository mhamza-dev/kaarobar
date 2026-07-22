
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "@/lib/api/client";
import Modal from "@/components/modals/Modal";
import Button from "@/components/ui/Button";
import DataTable from "@/components/ui/DataTable";
import { EmptyState, Field, PageHeader, TabBar, fieldClass } from "@/components/app/ui";
import { useToast } from "@/components/ui/Toast";
import { useT } from "@/lib/i18n";
import { detailRoutes } from "@/lib/navigation";

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
  const t = useT();
  const toast = useToast();
  const navigate = useNavigate();
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
  const [jeModal, setJeModal] = useState(false);
  const [accountModal, setAccountModal] = useState(false);
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [accountForm, setAccountForm] = useState({
    code: "",
    name: "",
    type: "expense",
  });
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
    try {
      const [acc, je] = await Promise.all([
        api<{ data: Account[] }>("/accounts").catch(() => ({ data: [] as Account[] })),
        api<{ data: Journal[] }>("/journals").catch(() => ({ data: [] as Journal[] })),
      ]);
      setAccounts(acc.data || []);
      setJournals(je.data || []);
      if (!glAccountId && acc.data?.[0]) setGlAccountId(acc.data[0].id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.loadFailed"));
    }
  }, [glAccountId, t, toast]);

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
      toast.error(err instanceof Error ? err.message : t("accounting.tbFailed"));
    }
  }

  async function loadPl() {
    try {
      const res = await api<{ data: PlData }>(
        `/reports/profit-and-loss?from=${from}&to=${to}`
      );
      setPl(res.data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("accounting.plFailed"));
    }
  }

  async function loadBs() {
    try {
      const res = await api<{ data: BsData }>(`/reports/balance-sheet?as_of=${to}`);
      setBs(res.data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("accounting.bsFailed"));
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
      toast.error(err instanceof Error ? err.message : t("accounting.glFailed"));
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
      toast.error(err instanceof Error ? err.message : t("accounting.agingFailed"));
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
      toast.success(t("accounting.journalPosted"));
      setJeDesc("");
      setLineA({ account_id: "", debit: "", credit: "" });
      setLineB({ account_id: "", debit: "", credit: "" });
      setJeModal(false);
      await loadCore();
      setTab("journals");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("accounting.journalFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function reverseJournal(id: string) {
    try {
      await api(`/journals/${id}/reverse`, { method: "POST", body: "{}" });
      toast.success(t("accounting.reversalPosted"));
      await loadCore();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("accounting.reverseFailed"));
    }
  }

  function openEditAccount(a: Account) {
    setEditingAccountId(a.id);
    setAccountForm({ code: a.code, name: a.name, type: a.type });
    setAccountModal(true);
  }

  async function saveAccount(e: React.FormEvent) {
    e.preventDefault();
    if (!editingAccountId) return;
    setBusy(true);
    try {
      await api(`/accounts/${editingAccountId}`, {
        method: "PATCH",
        body: JSON.stringify(accountForm),
      });
      toast.success(t("accounting.accountUpdated"));
      setAccountModal(false);
      setEditingAccountId(null);
      await loadCore();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("accounting.accountUpdateFailed"));
    } finally {
      setBusy(false);
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
        eyebrow={t("accounting.eyebrow")}
        title={t("pages.accountingTitle")}
        description={t("pages.accountingDesc")}
        action={
          tab === "journals"
            ? { label: t("accounting.postJournal"), onClick: () => setJeModal(true) }
            : undefined
        }
      />

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
        <DataTable
          maxHeight="28rem"
          searchable
          searchPlaceholder="Search accounts…"
          getSearchText={(a) => `${a.code} ${a.name} ${a.type}`}
          onRowClick={openEditAccount}
          columns={[
            {
              id: "code",
              header: "Code",
              cell: (a) => <span className="font-medium tabular-nums">{a.code}</span>,
            },
            {
              id: "name",
              header: "Name",
              cell: (a) => <span className="font-medium">{a.name}</span>,
            },
            {
              id: "type",
              header: "Type",
              cell: (a) => (
                <span className="inline-flex rounded-md bg-bg-tertiary px-2 py-0.5 text-xs font-semibold capitalize">
                  {a.type}
                </span>
              ),
            },
            {
              id: "actions",
              header: "",
              align: "right",
              width: 88,
              cell: (a) => (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation();
                    openEditAccount(a);
                  }}
                >
                  Edit
                </Button>
              ),
            },
          ]}
          data={accounts}
          rowKey={(a) => a.id}
          emptyTitle="No accounts"
          emptyBody="Accounts are seeded when you create a business."
        />
      ) : null}

      {tab === "journals" ? (
        <div className="space-y-4">
          {journals.length === 0 ? (
            <EmptyState
              title="No journals yet"
              body="Post a manual journal or wait for POS/inventory postings."
            />
          ) : null}
          <div className="max-h-[min(80vh,42rem)] space-y-3 overflow-y-auto">
            {journals.map((j) => (
              <div key={j.id} className="rounded-md border border-border bg-card p-4 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-heading">
                    <Link
                      to={detailRoutes.journal(j.id)}
                      className="font-semibold text-brand underline"
                    >
                      <strong className="text-heading">{j.date}</strong>
                    </Link>{" "}
                    · {j.description}{" "}
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
        <div className="space-y-3">
          <p className="text-sm text-body">
            {t("accounting.manageCustomersHint")}{" "}
            <a href="#/app/customers" className="text-brand underline">
              {t("nav.customers")}
            </a>
            .
          </p>
          <DataTable
            maxHeight="28rem"
            searchable
            searchPlaceholder="Search invoices…"
            getSearchText={(r) =>
              `${r.invoice_number || ""} ${r.customer_name || ""} ${r.balance_due} ${r.bucket}`
            }
            onRowClick={(r) => navigate(detailRoutes.arInvoice(r.id))}
            columns={[
              {
                id: "invoice",
                header: "Invoice",
                cell: (r) => (
                  <Link
                    to={detailRoutes.arInvoice(r.id)}
                    className="font-semibold text-brand underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {r.invoice_number || r.id.slice(0, 8)}
                  </Link>
                ),
              },
              {
                id: "customer",
                header: "Customer",
                cell: (r) => r.customer_name || "—",
              },
              {
                id: "balance",
                header: "Balance",
                align: "right",
                cell: (r) => <span className="tabular-nums">{r.balance_due}</span>,
              },
              { id: "bucket", header: "Bucket", cell: (r) => r.bucket },
            ]}
            data={arAging}
            rowKey={(r) => r.id}
            emptyTitle="No AR invoices"
          />
        </div>
      ) : null}

      {tab === "ap" ? (
        <DataTable
          maxHeight="28rem"
          searchable
          searchPlaceholder="Search bills…"
          getSearchText={(r) =>
            `${r.bill_number || ""} ${r.supplier_name || ""} ${r.balance_due} ${r.bucket}`
          }
          onRowClick={(r) => navigate(detailRoutes.apBill(r.id))}
          columns={[
            {
              id: "bill",
              header: "Bill",
              cell: (r) => (
                <Link
                  to={detailRoutes.apBill(r.id)}
                  className="font-semibold text-brand underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  {r.bill_number || r.id.slice(0, 8)}
                </Link>
              ),
            },
            {
              id: "supplier",
              header: "Supplier",
              cell: (r) => r.supplier_name || "—",
            },
            {
              id: "balance",
              header: "Balance",
              align: "right",
              cell: (r) => <span className="tabular-nums">{r.balance_due}</span>,
            },
            { id: "bucket", header: "Bucket", cell: (r) => r.bucket },
          ]}
          data={apAging}
          rowKey={(r) => r.id}
          emptyTitle="No AP bills"
        />
      ) : null}

      <Modal
        isOpen={accountModal}
        onClose={() => {
          setAccountModal(false);
          setEditingAccountId(null);
        }}
        title="Edit account"
        description="Update chart of accounts name, code, or type."
        footer={
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setAccountModal(false);
                setEditingAccountId(null);
              }}
            >
              Cancel
            </Button>
            <Button type="submit" form="account-modal-form" loading={busy}>
              Save changes
            </Button>
          </div>
        }
      >
        <form id="account-modal-form" onSubmit={saveAccount} className="space-y-4">
          <Field label="Code">
            <input
              className={fieldClass}
              value={accountForm.code}
              onChange={(e) => setAccountForm({ ...accountForm, code: e.target.value })}
              required
            />
          </Field>
          <Field label="Name">
            <input
              className={fieldClass}
              value={accountForm.name}
              onChange={(e) => setAccountForm({ ...accountForm, name: e.target.value })}
              required
            />
          </Field>
          <Field label="Type">
            <select
              className={fieldClass}
              value={accountForm.type}
              onChange={(e) => setAccountForm({ ...accountForm, type: e.target.value })}
            >
              {["asset", "liability", "equity", "revenue", "expense"].map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Field>
        </form>
      </Modal>

      <Modal
        isOpen={jeModal}
        onClose={() => setJeModal(false)}
        title="Post journal"
        description="Enter a balanced two-line manual journal entry."
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setJeModal(false)}>
              Cancel
            </Button>
            <Button type="submit" form="je-modal-form" loading={busy}>
              Post journal
            </Button>
          </div>
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
  const data = rows.map((cells, i) => ({ id: String(i), cells }));

  return (
    <DataTable
      maxHeight="28rem"
      searchable
      searchPlaceholder="Search rows…"
      getSearchText={(row) => (row.cells ?? []).join(" ")}
      columns={headers.map((h, i) => ({
        id: `c${i}`,
        header: h,
        cell: (row: { cells: (string | undefined)[] }) => (
          <span className={i > 0 ? "tabular-nums" : undefined}>
            {row.cells[i] ?? "—"}
          </span>
        ),
      }))}
      data={data}
      rowKey={(row) => row.id}
      emptyTitle="No rows"
    />
  );
}
