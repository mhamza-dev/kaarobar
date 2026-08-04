
import { Suspense, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BookPlus } from "lucide-react";
import { api, getSession } from "@/lib/api/client";
import Modal from "@/components/modals/Modal";
import Button from "@/components/ui/Button";
import DataTable from "@/components/ui/DataTable";
import ActionMenu from "@/components/ui/ActionMenu";
import { PageHeader, TabBar } from "@/components/app/ui";
import { useToast } from "@/components/ui/Toast";
import { useT } from "@/lib/i18n";
import { useTabQueryParam } from "@/lib/hooks/useTabQueryParam";
import { detailRoutes, routes } from "@/lib/navigation";
import { accountingKeys } from "@/lib/queryClient";
import { formatDecimal } from "@/lib/decimal";
import FormModalFooter from "@/components/app/FormModalFooter";
import CustomForm from "@/components/ui/CustomForm";
import {
  AccountFormFields,
  JournalEntryFormFields,
  emptyAccountForm,
  emptyJournalEntryForm,
} from "@/components/accounting/AccountingModalForms";
import {
  accountFormSchema,
  journalEntryFormSchema,
  type AccountFormValues,
  type JournalEntryFormValues,
} from "@/lib/validations/accounting";
import {
  emptyStaffListFilters,
  staffListFilterQuery,
  type ListFilterConfig,
} from "@/lib/listFilters";

type Tab = "coa" | "journals" | "tb" | "pl" | "bs" | "cf" | "gl" | "ar" | "ap";
const ACCOUNTING_TABS: readonly Tab[] = [
  "coa",
  "journals",
  "tb",
  "pl",
  "bs",
  "cf",
  "gl",
  "ar",
  "ap",
];

type Account = {
  id: string;
  code: string;
  name: string;
  type: string;
  parent_account_id?: string | null;
  normal_balance?: string;
  classification?: string | null;
  is_header?: boolean;
};
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
type StatementLine = {
  code: string;
  name: string;
  type: string;
  classification?: string;
  amount?: string;
  balance?: string;
};
type StatementSection = {
  classification: string;
  total: string;
  lines: StatementLine[];
};
type PlData = {
  lines: StatementLine[];
  sections?: {
    revenue?: StatementSection;
    cost_of_sales?: StatementSection;
    gross_profit?: string;
    other_income?: StatementSection;
    operating_expense?: StatementSection;
    operating_profit?: string;
    other_expense?: StatementSection;
    net_income?: string;
  };
  total_revenue: string;
  total_expense: string;
  net_income: string;
  gross_profit?: string;
  operating_profit?: string;
};
type BsData = {
  lines: StatementLine[];
  sections?: {
    current_assets?: StatementSection;
    non_current_assets?: StatementSection;
    total_assets?: string;
    current_liabilities?: StatementSection;
    non_current_liabilities?: StatementSection;
    total_liabilities?: string;
    equity?: StatementSection;
    total_equity?: string;
  };
  total_assets: string;
  total_liabilities: string;
  total_equity: string;
};
type CfData = {
  method: string;
  net_income: string;
  cash_from_operations: string;
  net_change_in_cash: string;
  changes?: {
    accounts_receivable?: string;
    inventory?: string;
    accounts_payable?: string;
  };
};
type GlRow = {
  date: string;
  description: string;
  debit: string;
  credit: string;
  balance: string;
  account_id?: string;
  account_code?: string;
  account_name?: string;
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
  return (
    <Suspense fallback={<p className="text-sm text-body">Loading…</p>}>
      <AccountingPageInner />
    </Suspense>
  );
}

function AccountingPageInner() {
  const t = useT();
  const toast = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const businessId = getSession()?.business_id ?? null;
  const [tab, setTab] = useTabQueryParam<Tab>("tb", ACCOUNTING_TABS, { pathname: routes.accounting });
  const [jeModal, setJeModal] = useState(false);
  const [accountModal, setAccountModal] = useState(false);
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [accountInitial, setAccountInitial] = useState(() => emptyAccountForm());
  const [jeInitial, setJeInitial] = useState(() => emptyJournalEntryForm());
  const [busy, setBusy] = useState(false);
  const [journalDetailId, setJournalDetailId] = useState<string | null>(null);
  const [journalFilters, setJournalFilters] = useState(emptyStaffListFilters);
  const [journalPage, setJournalPage] = useState(1);
  const [journalPageSize, setJournalPageSize] = useState(20);

  const [reportFilters, setReportFilters] = useState(() => {
    const d = new Date();
    return {
      ...emptyStaffListFilters(),
      from: `${d.getFullYear()}-01-01`,
      to: new Date().toISOString().slice(0, 10),
    };
  });

  const from = reportFilters.from;
  const to = reportFilters.to;

  const needAccounts = tab === "coa" || tab === "journals" || tab === "gl" || jeModal || accountModal;

  const { data: accounts = [], isLoading: accountsLoading } = useQuery({
    queryKey: accountingKeys.accounts(businessId),
    queryFn: async () => {
      const res = await api<{ data: Account[] }>("/accounts").catch(() => ({
        data: [] as Account[],
      }));
      return res.data || [];
    },
    enabled: needAccounts,
  });

  const journalQuery = staffListFilterQuery(journalFilters, {
    limit: String(journalPageSize),
    cursor: String((journalPage - 1) * journalPageSize),
    ...(journalFilters.statuses[0]
      ? { source: journalFilters.statuses[0] }
      : {}),
  });

  const {
    data: journalsPayload,
    isLoading: journalsLoading,
    isFetching: journalsFetching,
  } = useQuery({
    queryKey: accountingKeys.journals(businessId, journalQuery),
    queryFn: async () => {
      const res = await api<{
        data: Journal[];
        meta?: { limit: number; next_cursor: string | null };
      }>(`/journals${journalQuery}`).catch(() => ({
        data: [] as Journal[],
        meta: { limit: journalPageSize, next_cursor: null as string | null },
      }));
      return res;
    },
    enabled: tab === "journals",
  });

  const journals = journalsPayload?.data || [];
  const journalsHasMore = Boolean(journalsPayload?.meta?.next_cursor);
  const journalsTotalEstimate =
    (journalPage - 1) * journalPageSize +
    journals.length +
    (journalsHasMore ? journalPageSize : 0);

  const { data: journalDetail, isLoading: journalDetailLoading } = useQuery({
    queryKey: [...accountingKeys.all, "journal", journalDetailId] as const,
    queryFn: async () => {
      const res = await api<{ data: Journal }>(`/journals/${journalDetailId}`);
      return res.data;
    },
    enabled: !!journalDetailId,
  });

  const { data: tb = [], isLoading: tbLoading } = useQuery({
    queryKey: accountingKeys.trialBalance(businessId, from, to),
    queryFn: async () => {
      const res = await api<{ data: TbRow[] }>(
        `/reports/trial-balance?from=${from}&to=${to}`
      );
      return res.data || [];
    },
    enabled: tab === "tb",
  });

  const { data: pl = null, isLoading: plLoading } = useQuery({
    queryKey: accountingKeys.profitAndLoss(businessId, from, to),
    queryFn: async () => {
      const res = await api<{ data: PlData }>(
        `/reports/profit-and-loss?from=${from}&to=${to}`
      );
      return res.data;
    },
    enabled: tab === "pl",
  });

  const { data: bs = null, isLoading: bsLoading } = useQuery({
    queryKey: accountingKeys.balanceSheet(businessId, to),
    queryFn: async () => {
      const res = await api<{ data: BsData }>(`/reports/balance-sheet?as_of=${to}`);
      return res.data;
    },
    enabled: tab === "bs",
  });

  const { data: cf = null, isLoading: cfLoading } = useQuery({
    queryKey: accountingKeys.cashFlow(businessId, from, to),
    queryFn: async () => {
      const res = await api<{ data: CfData }>(
        `/reports/cash-flow?from=${from}&to=${to}`
      );
      return res.data;
    },
    enabled: tab === "cf",
  });

  const { data: gl = [], isLoading: glLoading } = useQuery({
    queryKey: accountingKeys.generalLedger(businessId, undefined, from, to),
    queryFn: async () => {
      const res = await api<{ data: GlRow[] }>(
        `/reports/general-ledger?from=${from}&to=${to}`
      );
      return res.data || [];
    },
    enabled: tab === "gl",
  });

  const glAccountOptions = useMemo(
    () =>
      accounts
        .filter((a) => !a.is_header)
        .map((a) => ({
          value: a.id,
          label: `${a.code} · ${a.name}`,
        })),
    [accounts]
  );

  const { data: arAging = [], isLoading: arLoading } = useQuery({
    queryKey: accountingKeys.arAging(businessId),
    queryFn: async () => {
      const res = await api<{ data: AgingRow[] }>("/ar/aging");
      return res.data || [];
    },
    enabled: tab === "ar",
  });

  const { data: apAging = [], isLoading: apLoading } = useQuery({
    queryKey: accountingKeys.apAging(businessId),
    queryFn: async () => {
      const res = await api<{ data: AgingRow[] }>("/ap/aging");
      return res.data || [];
    },
    enabled: tab === "ap",
  });

  async function refreshCore() {
    await queryClient.invalidateQueries({ queryKey: accountingKeys.accounts(businessId) });
    await queryClient.invalidateQueries({ queryKey: accountingKeys.journals(businessId) });
  }

  async function createJournal(values: JournalEntryFormValues) {
    setBusy(true);
    try {
      await api("/journals", {
        method: "POST",
        body: JSON.stringify({
          description: values.description,
          date: to,
          lines: [
            {
              account_id: values.lineA.account_id,
              debit: values.lineA.debit || "0",
              credit: values.lineA.credit || "0",
            },
            {
              account_id: values.lineB.account_id,
              debit: values.lineB.debit || "0",
              credit: values.lineB.credit || "0",
            },
          ],
        }),
      });
      toast.success(t("accounting.journalPosted"));
      setJeInitial(emptyJournalEntryForm());
      setJeModal(false);
      await refreshCore();
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
      await refreshCore();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("accounting.reverseFailed"));
    }
  }

  function openCreateAccount() {
    setEditingAccountId(null);
    setAccountInitial(emptyAccountForm());
    setAccountModal(true);
  }

  function openEditAccount(a: Account) {
    setEditingAccountId(a.id);
    setAccountInitial({
      code: a.code,
      name: a.name,
      type: a.type || "Expense",
      parent_account_id: a.parent_account_id || "",
      classification: a.classification || "operating_expense",
      normal_balance: a.normal_balance || "debit",
      is_header: Boolean(a.is_header),
    });
    setAccountModal(true);
  }

  async function saveAccount(values: AccountFormValues) {
    setBusy(true);
    const payload = {
      code: values.code,
      name: values.name,
      type: values.type,
      parent_account_id: values.parent_account_id || null,
      classification: values.classification,
      normal_balance: values.normal_balance,
      is_header: values.is_header,
    };
    try {
      if (editingAccountId) {
        await api(`/accounts/${editingAccountId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        toast.success(t("accounting.accountUpdated"));
      } else {
        await api("/accounts", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        toast.success(t("accounting.accountCreated"));
      }
      setAccountModal(false);
      setEditingAccountId(null);
      await refreshCore();
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : editingAccountId
            ? t("accounting.accountUpdateFailed")
            : t("accounting.accountCreateFailed")
      );
    } finally {
      setBusy(false);
    }
  }

  const sortedAccounts = useMemo(() => {
    const byParent = new Map<string | null, Account[]>();
    for (const a of accounts) {
      const key = a.parent_account_id || null;
      const list = byParent.get(key) || [];
      list.push(a);
      byParent.set(key, list);
    }
    for (const list of byParent.values()) {
      list.sort((x, y) => x.code.localeCompare(y.code));
    }
    const out: { account: Account; depth: number }[] = [];
    const walk = (parentId: string | null, depth: number) => {
      for (const a of byParent.get(parentId) || []) {
        out.push({ account: a, depth });
        walk(a.id, depth + 1);
      }
    };
    walk(null, 0);
    const seen = new Set(out.map((x) => x.account.id));
    for (const a of accounts) {
      if (!seen.has(a.id)) out.push({ account: a, depth: 0 });
    }
    return out;
  }, [accounts]);

  const tabs: { id: Tab; label: string; infoKey?: string }[] = [
    { id: "tb", label: t("accounting.trialBalance"), infoKey: "tab.accounting.tb" },
    { id: "pl", label: t("accounting.profitLoss"), infoKey: "tab.accounting.pl" },
    { id: "bs", label: t("accounting.balanceSheet"), infoKey: "tab.accounting.bs" },
    { id: "cf", label: t("accounting.cashFlow"), infoKey: "tab.accounting.cf" },
    { id: "gl", label: t("accounting.generalLedger"), infoKey: "tab.accounting.gl" },
    { id: "journals", label: t("accounting.tabs.journals"), infoKey: "tab.accounting.journals" },
    { id: "coa", label: t("accounting.tabs.coa"), infoKey: "tab.accounting.coa" },
    { id: "ar", label: t("accounting.aging"), infoKey: "tab.accounting.ar" },
    { id: "ap", label: "AP aging", infoKey: "tab.accounting.ap" },
  ];

  function sectionRows(
    section: StatementSection | undefined,
    valueKey: "amount" | "balance"
  ): (string | undefined)[][] {
    if (!section?.lines?.length) return [];
    return [
      [`— ${section.classification.replace(/_/g, " ")} —`, "", "", ""],
      ...section.lines.map((r) => [
        r.code,
        r.name,
        r.type,
        formatDecimal(valueKey === "amount" ? r.amount : r.balance),
      ]),
      ["", t("accounting.sectionTotal"), "", formatDecimal(section.total)],
    ];
  }

  const plRows = pl?.sections
    ? [
        ...sectionRows(pl.sections.revenue, "amount"),
        ...sectionRows(pl.sections.cost_of_sales, "amount"),
        ["", t("accounting.grossProfit"), "", formatDecimal(pl.sections.gross_profit || pl.gross_profit)],
        ...sectionRows(pl.sections.other_income, "amount"),
        ...sectionRows(pl.sections.operating_expense, "amount"),
        [
          "",
          t("accounting.operatingProfit"),
          "",
          formatDecimal(pl.sections.operating_profit || pl.operating_profit),
        ],
        ...sectionRows(pl.sections.other_expense, "amount"),
        ["", t("accounting.netIncome"), "", formatDecimal(pl.sections.net_income || pl.net_income)],
      ]
    : (pl?.lines || []).map((r) => [r.code, r.name, r.type, formatDecimal(r.amount)]);

  const bsRows = bs?.sections
    ? [
        ...sectionRows(bs.sections.current_assets, "balance"),
        ...sectionRows(bs.sections.non_current_assets, "balance"),
        ["", t("accounting.totalAssets"), "", formatDecimal(bs.sections.total_assets || bs.total_assets)],
        ...sectionRows(bs.sections.current_liabilities, "balance"),
        ...sectionRows(bs.sections.non_current_liabilities, "balance"),
        [
          "",
          t("accounting.totalLiabilities"),
          "",
          formatDecimal(bs.sections.total_liabilities || bs.total_liabilities),
        ],
        ...sectionRows(bs.sections.equity, "balance"),
        ["", t("accounting.totalEquity"), "", formatDecimal(bs.sections.total_equity || bs.total_equity)],
      ]
    : (bs?.lines || []).map((r) => [r.code, r.name, r.type, formatDecimal(r.balance)]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t("accounting.eyebrow")}
        title={t("pages.accountingTitle")}
        description={t("pages.accountingDesc")}
        infoKey="page.accounting"
        action={
          tab === "journals"
            ? {
                label: t("accounting.postJournal"),
                onClick: () => {
                  setJeInitial(emptyJournalEntryForm());
                  setJeModal(true);
                },
                icon: <BookPlus className="h-4 w-4" />,
              }
            : tab === "coa"
              ? {
                  label: t("accounting.newAccount"),
                  onClick: openCreateAccount,
                  icon: <BookPlus className="h-4 w-4" />,
                }
              : undefined
        }
      />

      <TabBar tabs={tabs} value={tab} onChange={setTab} />

      {tab === "coa" ? (
        <DataTable
          maxHeight="28rem"
          loading={accountsLoading}
          searchable
          searchPlaceholder={t("accounting.searchAccounts")}
          getSearchText={(row) =>
            `${row.account.code} ${row.account.name} ${row.account.type}`
          }
          onRowClick={(row) => openEditAccount(row.account)}
          columns={[
            {
              id: "code",
              header: "Code",
              cell: (row) => (
                <span
                  className="font-medium tabular-nums"
                  style={{ paddingInlineStart: `${row.depth * 1.1}rem` }}
                >
                  {row.account.code}
                </span>
              ),
            },
            {
              id: "name",
              header: "Name",
              cell: (row) => (
                <span className="font-medium">
                  {row.account.name}
                  {row.account.is_header ? (
                    <span className="ms-2 text-xs font-normal text-body">
                      ({t("accounting.headerAccount")})
                    </span>
                  ) : null}
                </span>
              ),
            },
            {
              id: "type",
              header: "Type",
              cell: (row) => (
                <span className="inline-flex rounded-md bg-bg-tertiary px-2 py-0.5 text-xs font-semibold">
                  {row.account.type}
                </span>
              ),
            },
            {
              id: "classification",
              header: t("accounting.classification"),
              cell: (row) => (
                <span className="text-xs text-body">
                  {(row.account.classification || "").replace(/_/g, " ") || "—"}
                </span>
              ),
            },
            {
              id: "actions",
              header: "",
              align: "right",
              width: 48,
              cell: (row) => (
                <div className="flex justify-end">
                  <ActionMenu
                    items={[
                      {
                        id: "edit",
                        label: "Edit",
                        onClick: () => openEditAccount(row.account),
                      },
                    ]}
                  />
                </div>
              ),
            },
          ]}
          data={sortedAccounts}
          rowKey={(row) => row.account.id}
          emptyTitle="No accounts"
          emptyBody="Accounts are seeded when you create a business."
        />
      ) : null}

      {tab === "journals" ? (
        <DataTable
          maxHeight="min(80vh,42rem)"
          loading={journalsLoading || journalsFetching}
          filterState={journalFilters}
          onFilterChange={(next) => {
            setJournalFilters(next);
            setJournalPage(1);
          }}
          filterConfig={{
            showDateRange: true,
            statusLabel: "Source",
            statusOptions: [
              { value: "manual", label: "manual" },
              { value: "pos_sale", label: "pos_sale" },
              { value: "inventory", label: "inventory" },
              { value: "payroll", label: "payroll" },
              { value: "reversal", label: "reversal" },
            ],
          }}
          clientFilter={false}
          searchPlaceholder={t("accounting.searchJournals")}
          pagination={{
            mode: "server",
            page: journalPage,
            pageSize: journalPageSize,
            total: Math.max(journalsTotalEstimate, journals.length),
            onPageChange: setJournalPage,
            onPageSizeChange: (size) => {
              setJournalPageSize(size);
              setJournalPage(1);
            },
          }}
          exportable
          exportFilename="journals"
          exportTitle="Journals"
          getExportRow={(j) => ({
            date: String(j.date),
            description: j.description,
            source: j.source_type,
            debit: formatDecimal(
              j.lines?.reduce((s, l) => s + Number(l.debit || 0), 0) ?? 0
            ),
            credit: formatDecimal(
              j.lines?.reduce((s, l) => s + Number(l.credit || 0), 0) ?? 0
            ),
          })}
          exportColumns={[
            { key: "date", header: "Date" },
            { key: "description", header: "Description" },
            { key: "source", header: "Source" },
            { key: "debit", header: "Debit" },
            { key: "credit", header: "Credit" },
          ]}
          onRowClick={(j) => setJournalDetailId(j.id)}
          columns={[
            {
              id: "date",
              header: "Date",
              cell: (j) => (
                <span className="font-medium tabular-nums">{j.date}</span>
              ),
            },
            {
              id: "description",
              header: "Description",
              cell: (j) => <span className="font-medium">{j.description}</span>,
            },
            {
              id: "source",
              header: "Source",
              cell: (j) => (
                <span className="text-body">{j.source_type}</span>
              ),
            },
            {
              id: "lines",
              header: "Lines",
              align: "right",
              cell: (j) => (
                <span className="tabular-nums text-body">
                  {j.lines?.length ?? 0}
                </span>
              ),
            },
            {
              id: "actions",
              header: "",
              align: "right",
              width: 48,
              cell: (j) => (
                <div
                  className="flex justify-end"
                  onClick={(e) => e.stopPropagation()}
                >
                  <ActionMenu
                    items={[
                      ...(j.is_locked && j.source_type !== "reversal"
                        ? [
                            {
                              id: "reverse",
                              label: "Reverse",
                              onClick: () => void reverseJournal(j.id),
                            },
                          ]
                        : []),
                    ]}
                  />
                </div>
              ),
            },
          ]}
          data={journals}
          rowKey={(j) => j.id}
          emptyTitle="No journals yet"
          emptyBody="Post a manual journal or wait for POS/inventory postings."
        />
      ) : null}

      {tab === "tb" ? (
        <StatementTable
          title="Trial balance"
          filename="trial-balance"
          headers={["Code", "Account", "Debit", "Credit"]}
          rows={tb.map((r) => [
            r.code,
            r.name,
            formatDecimal(r.debit),
            formatDecimal(r.credit),
          ])}
          loading={tbLoading}
          filterState={reportFilters}
          onFilterChange={setReportFilters}
          showDateRange
        />
      ) : null}

      {tab === "pl" ? (
        <div className="space-y-3">
          <StatementTable
            title={t("accounting.profitLoss")}
            filename="profit-and-loss"
            headers={["Code", "Account", "Type", "Amount"]}
            rows={plRows}
            loading={plLoading}
            filterState={reportFilters}
            onFilterChange={setReportFilters}
            showDateRange
          />
          {pl ? (
            <p className="text-heading">
              {t("accounting.ifrsHint")} · {t("accounting.netIncome")}{" "}
              <strong>{formatDecimal(pl.net_income)}</strong>
            </p>
          ) : null}
        </div>
      ) : null}

      {tab === "bs" ? (
        <div className="space-y-3">
          <StatementTable
            title={t("accounting.balanceSheet")}
            filename="balance-sheet"
            headers={["Code", "Account", "Type", "Balance"]}
            rows={bsRows}
            loading={bsLoading}
            filterState={reportFilters}
            onFilterChange={setReportFilters}
            showDateRange
          />
          {bs ? (
            <p className="text-sm text-heading">
              {t("accounting.totalAssets")} {formatDecimal(bs.total_assets)} ·{" "}
              {t("accounting.totalLiabilities")} {formatDecimal(bs.total_liabilities)} ·{" "}
              {t("accounting.totalEquity")} {formatDecimal(bs.total_equity)}
            </p>
          ) : null}
        </div>
      ) : null}

      {tab === "cf" ? (
        <div className="space-y-3">
          <StatementTable
            title={t("accounting.cashFlow")}
            filename="cash-flow"
            headers={["Item", "", "", "Amount"]}
            rows={
              cf
                ? [
                    [t("accounting.netIncome"), "", "", formatDecimal(cf.net_income)],
                    [
                      t("accounting.changeAr"),
                      "",
                      "",
                      formatDecimal(cf.changes?.accounts_receivable),
                    ],
                    [
                      t("accounting.changeInventory"),
                      "",
                      "",
                      formatDecimal(cf.changes?.inventory),
                    ],
                    [
                      t("accounting.changeAp"),
                      "",
                      "",
                      formatDecimal(cf.changes?.accounts_payable),
                    ],
                    [
                      t("accounting.cashFromOps"),
                      "",
                      "",
                      formatDecimal(cf.cash_from_operations),
                    ],
                  ]
                : []
            }
            loading={cfLoading}
            filterState={reportFilters}
            onFilterChange={setReportFilters}
            showDateRange
          />
          {cf ? (
            <p className="text-sm text-heading">
              {t("accounting.indirectMethod")} · {t("accounting.netChangeCash")}{" "}
              <strong>{formatDecimal(cf.net_change_in_cash)}</strong>
            </p>
          ) : null}
        </div>
      ) : null}

      {tab === "gl" ? (
        <StatementTable
          title="General ledger"
          filename="general-ledger"
          headers={["Date", "Account", "Description", "Debit", "Credit", "Balance"]}
          rows={gl.map((r) => [
            r.date,
            r.account_code && r.account_name
              ? `${r.account_code} · ${r.account_name}`
              : r.account_code || r.account_name || "",
            r.description,
            formatDecimal(r.debit),
            formatDecimal(r.credit),
            formatDecimal(r.balance),
          ])}
          rowCategories={gl.map((r) => r.account_id || "")}
          loading={glLoading || accountsLoading}
          filterState={reportFilters}
          onFilterChange={setReportFilters}
          showDateRange
          categoryOptions={glAccountOptions}
          categoryLabel="Account"
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
            loading={arLoading}
            searchable
            searchPlaceholder={t("accounting.searchInvoices")}
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
                cell: (r) => (
                  <span className="tabular-nums">{formatDecimal(r.balance_due)}</span>
                ),
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
          loading={apLoading}
          searchable
          searchPlaceholder={t("accounting.searchBills")}
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
              cell: (r) => (
                <span className="tabular-nums">{formatDecimal(r.balance_due)}</span>
              ),
            },
            { id: "bucket", header: "Bucket", cell: (r) => r.bucket },
          ]}
          data={apAging}
          rowKey={(r) => r.id}
          emptyTitle="No AP bills"
        />
      ) : null}

      <Modal
        isOpen={!!journalDetailId}
        onClose={() => setJournalDetailId(null)}
        title={journalDetail ? `Journal · ${journalDetail.date}` : "Journal"}
        description={journalDetail?.description}
        size="lg"
        footer={
          <div className="flex justify-end gap-2">
            {journalDetail ? (
              <Button
                variant="outline"
                onClick={() => {
                  navigate(detailRoutes.journal(journalDetail.id));
                  setJournalDetailId(null);
                }}
              >
                Open detail
              </Button>
            ) : null}
            {journalDetail?.is_locked &&
            journalDetail.source_type !== "reversal" ? (
              <Button
                variant="outline"
                onClick={() => {
                  void reverseJournal(journalDetail.id);
                  setJournalDetailId(null);
                }}
              >
                Reverse
              </Button>
            ) : null}
            <Button variant="outline" onClick={() => setJournalDetailId(null)}>
              {t("common.close")}
            </Button>
          </div>
        }
      >
        {journalDetailLoading || !journalDetail ? (
          <p className="text-sm text-body">{t("common.loading")}</p>
        ) : (
          <DataTable
            maxHeight="20rem"
            columns={[
              {
                id: "account",
                header: "Account",
                cell: (l) =>
                  `${l.account_code || l.account_id.slice(0, 8)}${
                    l.account_name ? ` · ${l.account_name}` : ""
                  }`,
              },
              {
                id: "debit",
                header: "Debit",
                align: "right",
                cell: (l) => <span className="tabular-nums">{formatDecimal(l.debit)}</span>,
              },
              {
                id: "credit",
                header: "Credit",
                align: "right",
                cell: (l) => <span className="tabular-nums">{formatDecimal(l.credit)}</span>,
              },
              {
                id: "memo",
                header: "Memo",
                cell: (l) => l.memo || "—",
              },
            ]}
            data={journalDetail.lines || []}
            rowKey={(_, i) => String(i)}
            emptyTitle="No lines"
          />
        )}
      </Modal>

      <Modal
        isOpen={accountModal}
        onClose={() => {
          setAccountModal(false);
          setEditingAccountId(null);
        }}
        title={editingAccountId ? t("accounting.editAccount") : t("accounting.createAccount")}
        description={
          editingAccountId
            ? t("accounting.editAccountDesc")
            : t("accounting.createAccountDesc")
        }
        footer={
          <FormModalFooter
            cancelLabel="Cancel"
            submitLabel={editingAccountId ? t("common.save") : t("accounting.createAccount")}
            onCancel={() => {
              setAccountModal(false);
              setEditingAccountId(null);
            }}
            submitFormId="account-modal-form"
            loading={busy}
          />
        }
      >
        <CustomForm
          id="account-modal-form"
          className="space-y-4"
          initialValues={accountInitial}
          validationSchema={accountFormSchema}
          enableReinitialize
          onSubmit={async (values) => {
            await saveAccount(values);
          }}
        >
          {() => (
            <AccountFormFields
              accounts={accounts}
              editingAccountId={editingAccountId}
            />
          )}
        </CustomForm>
      </Modal>

      <Modal
        isOpen={jeModal}
        onClose={() => setJeModal(false)}
        title="Post journal"
        description="Enter a balanced two-line manual journal entry."
        footer={
          <FormModalFooter
            cancelLabel="Cancel"
            submitLabel="Post journal"
            onCancel={() => setJeModal(false)}
            submitFormId="je-modal-form"
            loading={busy}
          />
        }
      >
        <CustomForm
          id="je-modal-form"
          className="space-y-4"
          initialValues={jeInitial}
          validationSchema={journalEntryFormSchema}
          enableReinitialize
          onSubmit={async (values) => {
            await createJournal(values);
          }}
        >
          {() => <JournalEntryFormFields accounts={accounts} />}
        </CustomForm>
      </Modal>
    </div>
  );
}

function StatementTable({
  headers,
  rows,
  loading = false,
  title = "Statement",
  filename = "statement",
  filterState,
  onFilterChange,
  showDateRange = false,
  categoryOptions,
  categoryLabel,
  rowCategories,
}: {
  headers: string[];
  rows: (string | undefined)[][];
  loading?: boolean;
  title?: string;
  filename?: string;
  filterState?: ReturnType<typeof emptyStaffListFilters>;
  onFilterChange?: (next: ReturnType<typeof emptyStaffListFilters>) => void;
  showDateRange?: boolean;
  categoryOptions?: ListFilterConfig["categoryOptions"];
  categoryLabel?: string;
  rowCategories?: string[];
}) {
  const t = useT();
  const [localFilters, setLocalFilters] = useState(emptyStaffListFilters);
  const filters = filterState ?? localFilters;
  const setFilters = onFilterChange ?? setLocalFilters;
  const data = rows.map((cells, i) => ({
    id: String(i),
    cells,
    category: rowCategories?.[i] ?? "",
  }));
  const filterConfig: ListFilterConfig = {
    ...(showDateRange ? { showDateRange: true } : {}),
    ...(categoryOptions?.length
      ? { categoryOptions, categoryLabel: categoryLabel ?? t("listFilters.categories") }
      : {}),
  };

  return (
    <DataTable
      maxHeight="28rem"
      loading={loading}
      filterState={filters}
      onFilterChange={setFilters}
      filterConfig={filterConfig}
      filterAccessors={{
        searchText: (row) => (row.cells ?? []).join(" "),
        category: (row) => row.category || null,
      }}
      clientFilter
      searchPlaceholder={t("accounting.searchRows")}
      pagination={{ mode: "client", pageSize: 20 }}
      exportable
      exportFilename={filename}
      exportTitle={title}
      getExportRow={(row) =>
        Object.fromEntries(
          headers.map((h, i) => [String(i), row.cells[i] ?? ""])
        )
      }
      exportColumns={headers.map((h, i) => ({ key: String(i), header: h }))}
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
      emptyTitle={t("table.noMatches")}
    />
  );
}
