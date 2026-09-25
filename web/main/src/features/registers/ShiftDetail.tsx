"use client";

import { CheckCircle2, Scale, TriangleAlert } from "lucide-react";
import { useState } from "react";

import { DataTable, type DataTableColumn } from "@/components/shared/DataTable/DataTable";
import { DescriptionList } from "@/components/shared/DescriptionList";
import { DetailSkeleton } from "@/components/shared/DetailSkeleton";
import { LoadError } from "@/components/shared/LoadError";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCashMovements, useShift, useShiftReconciliation } from "@/hooks/queries/useRegisters";
import { usePermission } from "@/hooks/usePermission";
import { formatDateTime, formatMoney, formatSigned, humanize, isNegative } from "@/lib/format";
import { useSessionStore } from "@/stores/sessionStore";
import type { CashMovement, ShiftFigures } from "@/types/api/sales";

import { CashMovementDialog } from "./CashMovementDialog";
import { CloseShiftDialog } from "./CloseShiftDialog";

/**
 * One drawer session: what it took, by tender; the cash that went in and
 * out outside sales; and, once closed, whether the count balanced. An open
 * shift's expected cash is live — this is the X report — and a closed one's
 * figures are the Z report.
 */
export function ShiftDetail({ shiftId }: { shiftId: string }) {
  const { can } = usePermission();
  const currency = useSessionStore((state) => state.scope?.business?.currency) ?? "PKR";
  const { data: shift, isLoading, isError, refetch } = useShift(shiftId);
  const [closing, setClosing] = useState(false);
  const [checking, setChecking] = useState(false);

  if (isLoading) return <DetailSkeleton />;
  if (isError || !shift) return <LoadError what="this shift" onRetry={() => refetch()} />;

  const money = (value: string | null | undefined) => formatMoney(value, currency);
  const open = shift.status === "open";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <StatusBadge status={shift.status} />
            {!open &&
              (shift.balanced ? (
                <Badge variant="secondary" className="gap-1">
                  <CheckCircle2 className="size-3" /> Balanced
                </Badge>
              ) : (
                <Badge variant="destructive" className="gap-1">
                  <TriangleAlert className="size-3" /> {formatSigned(shift.cash_variance)} out
                </Badge>
              ))}
          </div>
          <DescriptionList
            layout="inline"
            items={[
              { label: "Register", value: shift.register?.name },
              { label: "Opened", value: formatDateTime(shift.opened_at) },
              { label: "By", value: shift.opened_by?.name },
              { label: "Closed", value: formatDateTime(shift.closed_at), hidden: open },
              { label: "Closed by", value: shift.closed_by?.name, hidden: open },
            ]}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {open && can("cash:movement") && (
            <CashMovementDialog shiftId={shift.id} currency={currency} />
          )}
          {can("shift:close") && (
            <Button variant="outline" onClick={() => setChecking((value) => !value)}>
              <Scale className="size-4" />
              {checking ? "Hide check" : "Check the figures"}
            </Button>
          )}
          {open && can("shift:close") && (
            <Button onClick={() => setClosing(true)}>Close shift</Button>
          )}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Figure
          label="Net sales"
          value={money(shift.net_sales)}
          detail={`${shift.sales_count} sales`}
        />
        <Figure label="Refunds" value={money(shift.refund_total)} />
        <Figure
          label={open ? "Cash expected now" : "Cash expected"}
          value={money(shift.expected_cash)}
          detail={`${money(shift.opening_float)} float`}
        />
        {open ? (
          <Figure
            label="Cash in / out"
            value={`${money(shift.cash_in)} / ${money(shift.cash_out)}`}
          />
        ) : (
          <Figure
            label="Cash counted"
            value={money(shift.declared_cash)}
            detail={
              shift.cash_variance ? `${formatSigned(shift.cash_variance)} variance` : undefined
            }
            tone={shift.cash_variance && isNegative(shift.cash_variance) ? "danger" : undefined}
          />
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold">By tender</h2>
          <DescriptionList
            className="rounded-xl border border-border px-3"
            items={Object.entries(shift.tender_totals ?? {}).map(([method, total]) => ({
              label: humanize(method),
              value: money(total),
            }))}
          />
          {Object.keys(shift.tender_totals ?? {}).length === 0 && (
            <p className="text-sm text-muted-foreground">Nothing taken yet.</p>
          )}
        </section>

        {can("cash:movement") && (
          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold">Cash movements</h2>
            <CashMovements shiftId={shift.id} currency={currency} />
          </section>
        )}
      </div>

      {checking && <Reconciliation shiftId={shift.id} currency={currency} />}

      {shift.notes && (
        <p className="rounded-lg border border-border bg-muted/40 p-3 text-sm">{shift.notes}</p>
      )}

      <CloseShiftDialog
        shift={closing ? shift : null}
        onOpenChange={(next) => !next && setClosing(false)}
      />
    </div>
  );
}

function Figure({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail?: string;
  tone?: "danger";
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={`text-lg font-semibold tabular-nums ${tone === "danger" ? "text-destructive" : ""}`}
      >
        {value}
      </p>
      {detail && <p className="text-xs text-muted-foreground">{detail}</p>}
    </div>
  );
}

function CashMovements({ shiftId, currency }: { shiftId: string; currency: string }) {
  const { data, isLoading, error, refetch } = useCashMovements(shiftId);

  const columns: DataTableColumn<CashMovement>[] = [
    {
      key: "kind",
      header: "Movement",
      render: (movement) => (
        <div>
          <p>{humanize(movement.kind)}</p>
          <p className="text-xs text-muted-foreground">
            {formatDateTime(movement.occurred_at)}
            {movement.actor_label && ` · ${movement.actor_label}`}
          </p>
        </div>
      ),
    },
    { key: "reason", header: "For", render: (movement) => movement.reason ?? "—" },
    {
      key: "amount",
      header: "Amount",
      align: "end",
      render: (movement) =>
        `${movement.outward ? "−" : "+"}${formatMoney(movement.amount, currency)}`,
    },
  ];

  return (
    <DataTable
      embedded
      columns={columns}
      rows={data ?? []}
      rowKey={(movement) => movement.id}
      loading={isLoading}
      error={error ? { message: error.message } : null}
      onRetry={() => refetch()}
      empty={
        <p className="p-6 text-center text-sm text-muted-foreground">
          No cash has gone in or out outside sales.
        </p>
      }
      mobileCardTitle={(movement) => humanize(movement.kind)}
      mobileCardSubtitle={(movement) => movement.reason ?? ""}
      mobileCardFields={[
        {
          key: "amount",
          label: "Amount",
          render: (movement) =>
            `${movement.outward ? "−" : "+"}${formatMoney(movement.amount, currency)}`,
        },
      ]}
    />
  );
}

/**
 * The running totals against the same figures recomputed from the sales.
 * They should always agree; this is how anyone checks, and what to show an
 * owner who asks "are you sure?".
 */
function Reconciliation({ shiftId, currency }: { shiftId: string; currency: string }) {
  const { data, isLoading, error, refetch } = useShiftReconciliation(shiftId, true);

  if (error) return <LoadError what="the check" onRetry={() => refetch()} />;
  if (isLoading || !data) return <DetailSkeleton rows={3} />;

  const rows: Array<[string, (figures: ShiftFigures) => string]> = [
    ["Sales", (figures) => String(figures.sales_count)],
    ["Gross sales", (figures) => formatMoney(figures.gross_sales, currency)],
    ["Tax", (figures) => formatMoney(figures.tax_total, currency)],
    ["Discounts", (figures) => formatMoney(figures.discount_total, currency)],
  ];

  return (
    <section className="flex flex-col gap-2 rounded-xl border border-border p-4">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-semibold">Recorded against recomputed</h2>
        {data.agrees ? (
          <Badge variant="secondary" className="gap-1">
            <CheckCircle2 className="size-3" /> They agree
          </Badge>
        ) : (
          <Badge variant="destructive">They differ</Badge>
        )}
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-muted-foreground">
            <th className="py-1 font-normal">Figure</th>
            <th className="py-1 text-right font-normal">Running total</th>
            <th className="py-1 text-right font-normal">From the sales</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, pick]) => (
            <tr key={label} className="border-t border-border">
              <td className="py-1.5">{label}</td>
              <td className="py-1.5 text-right tabular-nums">{pick(data.recorded)}</td>
              <td className="py-1.5 text-right tabular-nums">{pick(data.computed)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
