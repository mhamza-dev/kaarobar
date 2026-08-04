import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, getSession } from "@/lib/api/client";
import Button from "@/components/ui/Button";
import DataTable from "@/components/ui/DataTable";
import CustomForm from "@/components/ui/CustomForm";
import {
  FormikSelectField,
  FormikTextField,
} from "@/components/ui/FormFields";
import {
  PageHeader,
  StatusBadge,
  SurfaceCard,
  formStackClass,
} from "@/components/app/ui";
import { useToast } from "@/components/ui/Toast";
import { formatDecimal } from "@/lib/decimal";
import { useT } from "@/lib/i18n";
import { detailRoutes } from "@/lib/navigation";
import { canAccessBundle } from "@/lib/rbac";
import {
  emptyStaffListFilters,
  type ListFilterConfig,
  type StaffListFilterState,
} from "@/lib/listFilters";
import {
  emptyReturnSubmitForm,
  emptySaleLookupForm,
  returnSubmitFormSchema,
  saleLookupFormSchema,
  type ReturnSubmitFormValues,
  type SaleLookupFormValues,
} from "@/lib/validations/returns";

type SaleItem = {
  product_id: string;
  name: string;
  quantity: string;
  line_total: string;
};

type Sale = {
  id: string;
  invoice_number: string;
  total_amount: string;
  items: SaleItem[];
};

type ReturnRow = {
  id: string;
  sale_id: string;
  status: string;
  refund_amount: string;
  refund_method: string;
  reason?: string;
  items: { product_id: string; quantity: string; amount: string }[];
};

type Till = {
  id: string;
  status: string;
  opening_cash: string;
  closing_cash?: string | null;
  expected_cash?: string | null;
  over_short?: string | null;
  opened_at?: string;
  closed_at?: string | null;
};

export default function ReturnsPage() {
  const t = useT();
  const toast = useToast();
  const navigate = useNavigate();
  const canApprove = canAccessBundle(getSession(), "pos_approve");
  const [sale, setSale] = useState<Sale | null>(null);
  const [pending, setPending] = useState<ReturnRow[]>([]);
  const [returns, setReturns] = useState<ReturnRow[]>([]);
  const [returnFilters, setReturnFilters] = useState<StaffListFilterState>(
    emptyStaffListFilters()
  );
  const [tillFilters, setTillFilters] = useState(emptyStaffListFilters());
  const [tills, setTills] = useState<Till[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [lookupInitial, setLookupInitial] = useState(emptySaleLookupForm());

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [p, r, t] = await Promise.all([
        api<{ data: ReturnRow[] }>("/returns/pending"),
        api<{ data: ReturnRow[] }>("/returns"),
        api<{ data: Till[] }>("/tills"),
      ]);
      setPending(p.data || []);
      setReturns(r.data || []);
      setTills(t.data || []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("returns.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t, toast]);

  useEffect(() => {
    reload();
  }, [reload]);

  async function lookupSale(values: SaleLookupFormValues) {
    setBusy(true);
    try {
      const res = await api<{ data: Sale }>(`/sales/${values.sale_id.trim()}`);
      setSale(res.data);
      setLookupInitial({ sale_id: values.sale_id.trim() });
    } catch (err) {
      setSale(null);
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  async function submitReturn(values: ReturnSubmitFormValues) {
    if (!sale) return;
    const session = getSession();
    const items = Object.entries(values.quantities)
      .filter(([, q]) => Number(q) > 0)
      .map(([product_id, quantity]) => ({ product_id, quantity }));

    if (items.length === 0) {
      toast.warning(t("common.quantity"));
      return;
    }

    setBusy(true);
    try {
      const res = await api<{ data: ReturnRow }>("/returns", {
        method: "POST",
        body: JSON.stringify({
          sale_id: sale.id,
          branch_id: session?.branch_id,
          reason: values.reason,
          refund_method: values.refund_method,
          items,
        }),
      });
      toast.success(
        `${t("returns.returnSubmitted")} · ${formatDecimal(res.data.refund_amount)}`
      );
      setSale(null);
      setLookupInitial(emptySaleLookupForm());
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  async function approve(id: string) {
    setBusy(true);
    try {
      await api(`/returns/${id}/approve`, { method: "POST", body: "{}" });
      await reload();
      toast.success(t("returns.returnApproved"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  async function reject(id: string) {
    setBusy(true);
    try {
      await api(`/returns/${id}/reject`, {
        method: "POST",
        body: JSON.stringify({ reason: "Rejected by manager" }),
      });
      await reload();
      toast.success(t("returns.returnRejected"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  const returnFilterConfig = useMemo<ListFilterConfig>(
    () => ({
      showDateRange: false,
      statusOptions: [
        { value: "pending", label: "Pending" },
        { value: "approved", label: "Approved" },
        { value: "rejected", label: "Rejected" },
      ],
    }),
    []
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t("returns.eyebrow")}
        title={t("pages.returnsTitle")}
        description={t("pages.returnsDesc")}
        infoKey="page.returns"
      />

      <SurfaceCard className="p-5">
        <h2 className="font-semibold text-heading">Create return</h2>
        <CustomForm
          initialValues={lookupInitial}
          validationSchema={saleLookupFormSchema}
          onSubmit={lookupSale}
          className="mt-3 flex flex-wrap gap-2"
        >
          {() => (
            <>
              <div className="min-w-64 flex-1">
                <FormikTextField name="sale_id" placeholder="Sale ID" />
              </div>
              <Button type="submit" disabled={busy} loading={busy}>
                Lookup
              </Button>
            </>
          )}
        </CustomForm>

        {sale ? (
          <CustomForm
            key={sale.id}
            initialValues={emptyReturnSubmitForm(
              (sale.items || []).map((i) => i.product_id)
            )}
            validationSchema={returnSubmitFormSchema}
            onSubmit={submitReturn}
            className={`mt-4 ${formStackClass}`}
          >
            {() => (
              <>
                <p className="text-sm text-heading">
                  Invoice {sale.invoice_number} · Total Rs{" "}
                  {formatDecimal(sale.total_amount)}
                </p>
                <ul className="space-y-2 text-sm">
                  {sale.items.map((item) => (
                    <li
                      key={item.product_id}
                      className="flex items-center gap-3 text-heading"
                    >
                      <span className="flex-1">
                        {item.name} (sold {item.quantity})
                      </span>
                      <FormikTextField
                        name={`quantities.${item.product_id}`}
                        placeholder="Qty"
                        className="w-24"
                      />
                    </li>
                  ))}
                </ul>
                <div className="flex flex-wrap gap-3">
                  <FormikSelectField
                    name="refund_method"
                    className="w-auto min-w-[10rem]"
                    options={[
                      { value: "cash", label: "Cash refund" },
                      { value: "card", label: "Card refund" },
                      { value: "wallet", label: "Wallet refund" },
                    ]}
                  />
                  <FormikTextField
                    name="reason"
                    placeholder="Reason"
                    className="min-w-48 flex-1"
                  />
                  <Button type="submit" disabled={busy} loading={busy}>
                    Submit return
                  </Button>
                </div>
              </>
            )}
          </CustomForm>
        ) : null}
      </SurfaceCard>

      <SurfaceCard className="p-5">
        <h2 className="font-semibold text-heading">Pending approval</h2>
        {pending.length === 0 ? (
          <p className="mt-2 text-sm text-body">No pending returns</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {pending.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-sm text-heading"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <Link
                      to={detailRoutes.saleReturn(r.id)}
                      className="font-semibold text-brand underline"
                    >
                      Rs {formatDecimal(r.refund_amount)}
                    </Link>
                    <span>· {r.refund_method}</span>
                    <StatusBadge tone="warning">{r.status}</StatusBadge>
                  </div>
                  <div className="text-body">{r.reason || "No reason"}</div>
                </div>
                <div className="flex gap-2">
                  {canApprove ? (
                    <>
                      <Button size="sm" disabled={busy} onClick={() => approve(r.id)}>
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => reject(r.id)}
                      >
                        Reject
                      </Button>
                    </>
                  ) : (
                    <span className="text-xs text-muted">Awaiting owner/admin</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </SurfaceCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <DataTable
          maxHeight="22rem"
          loading={loading}
          filterState={returnFilters}
          onFilterChange={setReturnFilters}
          filterConfig={returnFilterConfig}
          filterAccessors={{
            searchText: (r) =>
              `${r.status} ${r.refund_amount} ${r.refund_method} ${r.sale_id} ${r.reason ?? ""}`,
            status: (r) => r.status.toLowerCase(),
          }}
          clientFilter
          searchPlaceholder={t("returns.searchReturns")}
          pagination={{ mode: "client", pageSize: 20 }}
          exportable
          exportFilename="returns"
          exportTitle="Recent returns"
          getExportRow={(r) => ({
            status: r.status,
            amount: formatDecimal(r.refund_amount),
            method: r.refund_method,
            sale: r.sale_id,
          })}
          exportColumns={[
            { key: "status", header: "Status" },
            { key: "amount", header: "Amount" },
            { key: "method", header: "Method" },
            { key: "sale", header: "Sale" },
          ]}
          onRowClick={(r) => navigate(detailRoutes.saleReturn(r.id))}
          columns={[
            {
              id: "status",
              header: "Status",
              cell: (r) => (
                <StatusBadge
                  tone={
                    r.status === "approved" || r.status === "Approved"
                      ? "success"
                      : r.status === "rejected" || r.status === "Rejected"
                        ? "danger"
                        : "warning"
                  }
                >
                  {r.status}
                </StatusBadge>
              ),
            },
            {
              id: "amount",
              header: "Amount",
              align: "right",
              cell: (r) => (
                <Link
                  to={detailRoutes.saleReturn(r.id)}
                  className="tabular-nums font-medium text-brand underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  {formatDecimal(r.refund_amount)}
                </Link>
              ),
            },
            { id: "method", header: "Method", cell: (r) => r.refund_method },
            {
              id: "sale",
              header: "Sale",
              cell: (r) => (
                <Link
                  to={detailRoutes.sale(r.sale_id)}
                  className="font-mono text-xs text-brand underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  {r.sale_id.slice(0, 8)}…
                </Link>
              ),
            },
          ]}
          data={returns}
          rowKey={(r) => r.id}
          emptyTitle="No returns yet"
          toolbar={<span className="text-sm font-semibold text-heading">Recent returns</span>}
        />

        <DataTable
          maxHeight="22rem"
          loading={loading}
          filterState={tillFilters}
          onFilterChange={setTillFilters}
          filterAccessors={{
            searchText: (row) =>
              `${row.status} ${row.opening_cash} ${row.expected_cash ?? ""} ${row.closing_cash ?? ""}`,
          }}
          clientFilter
          searchPlaceholder={t("returns.searchTills")}
          pagination={{ mode: "client", pageSize: 20 }}
          exportable
          exportFilename="tills"
          exportTitle="Till history"
          getExportRow={(row) => ({
            status: row.status,
            opening: formatDecimal(row.opening_cash),
            expected:
              row.expected_cash != null && row.expected_cash !== ""
                ? formatDecimal(row.expected_cash)
                : "",
            closing:
              row.closing_cash != null && row.closing_cash !== ""
                ? formatDecimal(row.closing_cash)
                : "",
            over:
              row.over_short != null && row.over_short !== ""
                ? formatDecimal(row.over_short)
                : "",
          })}
          exportColumns={[
            { key: "status", header: "Status" },
            { key: "opening", header: "Opening" },
            { key: "expected", header: "Expected" },
            { key: "closing", header: "Closing" },
            { key: "over", header: "Over/short" },
          ]}
          columns={[
            { id: "status", header: "Status", cell: (row) => row.status },
            {
              id: "opening",
              header: "Opening",
              align: "right",
              cell: (row) => (
                <span className="tabular-nums">{formatDecimal(row.opening_cash)}</span>
              ),
            },
            {
              id: "expected",
              header: "Expected",
              align: "right",
              cell: (row) => (
                <span className="tabular-nums">
                  {row.expected_cash != null && row.expected_cash !== ""
                    ? formatDecimal(row.expected_cash)
                    : "—"}
                </span>
              ),
            },
            {
              id: "closing",
              header: "Closing",
              align: "right",
              cell: (row) => (
                <span className="tabular-nums">
                  {row.closing_cash != null && row.closing_cash !== ""
                    ? formatDecimal(row.closing_cash)
                    : "—"}
                </span>
              ),
            },
            {
              id: "over",
              header: "Over/short",
              align: "right",
              cell: (row) => (
                <span className="tabular-nums">
                  {row.over_short != null && row.over_short !== ""
                    ? formatDecimal(row.over_short)
                    : "—"}
                </span>
              ),
            },
          ]}
          data={tills}
          rowKey={(row) => row.id}
          emptyTitle="No till sessions"
          toolbar={<span className="text-sm font-semibold text-heading">Till history</span>}
        />
      </div>
    </div>
  );
}
