"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api, getSession } from "@/lib/api/client";
import { detailRoutes, routes } from "@/lib/navigation";
import { DetailFieldGrid, DetailSection, DetailShell } from "@/components/app/DetailShell";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { canAccessBundle } from "@/lib/rbac";

type Payslip = {
  id: string;
  employee_id: string;
  employee_name?: string | null;
  employee_code?: string | null;
  days_worked?: string;
  overtime_hours?: string;
  gross_pay: string;
  net_pay: string;
  earnings?: Record<string, string | number | undefined> | null;
  deductions?: Record<string, string | number | undefined> | null;
};

type PayrollRun = {
  id: string;
  period_start: string;
  period_end: string;
  status: string;
  journal_entry_id?: string | null;
  approved_by_id?: string | null;
  payslips: Payslip[];
};

export default function PayrollDetailPage() {
  const { id } = useParams<{ id: string }>();
  const toast = useToast();
  const canApprove = canAccessBundle(getSession(), "payroll_approve");
  const [run, setRun] = useState<PayrollRun | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api<{ data: PayrollRun }>(`/payroll/${id}`);
      setRun(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load payroll");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(action: "submit" | "approve" | "reject" | "recalculate") {
    setBusy(true);
    try {
      await api(`/payroll/${id}/${action}`, { method: "POST", body: "{}" });
      toast.success(
        action === "approve"
          ? "Payroll approved"
          : action === "reject"
            ? "Payroll rejected"
            : action === "submit"
              ? "Submitted for approval"
              : "Recalculated",
      );
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  const draft = run?.status === "Draft" || run?.status === "Rejected";
  const pending = run?.status === "PendingApproval";
  const totalNet =
    run?.payslips.reduce((s, p) => s + Number(p.net_pay || 0), 0) ?? 0;

  return (
    <DetailShell
      backHref={routes.hr}
      backLabel="Back to HR"
      eyebrow="Payroll"
      title={
        run ? `${run.period_start} → ${run.period_end}` : "Payroll run"
      }
      subtitle={run ? `${run.payslips.length} payslip(s) · Rs ${totalNet.toFixed(2)} net` : undefined}
      status={
        run
          ? {
              label: run.status,
              tone:
                run.status === "Approved"
                  ? "success"
                  : pending
                    ? "warning"
                    : run.status === "Rejected"
                      ? "danger"
                      : "info",
            }
          : undefined
      }
      loading={loading}
      error={error}
      actions={
        <>
          {draft ? (
            <>
              <Button loading={busy} variant="outline" onClick={() => void act("recalculate")}>
                Recalculate
              </Button>
              <Button loading={busy} onClick={() => void act("submit")}>
                Submit
              </Button>
            </>
          ) : null}
          {pending && canApprove ? (
            <>
              <Button loading={busy} onClick={() => void act("approve")}>
                Approve & post
              </Button>
              <Button loading={busy} variant="outline" onClick={() => void act("reject")}>
                Reject
              </Button>
            </>
          ) : null}
        </>
      }
    >
      {run ? (
        <>
          <DetailSection title="Run">
            <DetailFieldGrid
              fields={[
                { label: "Period start", value: run.period_start },
                { label: "Period end", value: run.period_end },
                {
                  label: "Journal",
                  value: run.journal_entry_id ? (
                    <Link
                      href={detailRoutes.journal(run.journal_entry_id)}
                      className="text-brand underline"
                    >
                      View entry
                    </Link>
                  ) : (
                    "—"
                  ),
                },
                { label: "Payslips", value: String(run.payslips.length) },
              ]}
            />
          </DetailSection>
          <DetailSection title="Payslips">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-muted">
                  <th className="py-2">Employee</th>
                  <th className="py-2">Days</th>
                  <th className="py-2">Hours</th>
                  <th className="py-2">OT</th>
                  <th className="py-2 text-right">Gross</th>
                  <th className="py-2 text-right">Net</th>
                </tr>
              </thead>
              <tbody>
                {run.payslips.map((s) => (
                  <tr key={s.id} className="border-b border-border/50">
                    <td className="py-2">
                      <Link
                        href={detailRoutes.employee(s.employee_id)}
                        className="font-medium text-brand underline"
                      >
                        {s.employee_name || s.employee_code || s.employee_id.slice(0, 8)}
                      </Link>
                    </td>
                    <td className="py-2">{s.days_worked ?? "—"}</td>
                    <td className="py-2">{s.earnings?.worked_hours ?? "—"}</td>
                    <td className="py-2">
                      {s.overtime_hours ?? s.earnings?.ot_hours ?? "—"}
                    </td>
                    <td className="py-2 text-right tabular-nums">Rs {s.gross_pay}</td>
                    <td className="py-2 text-right tabular-nums font-medium">Rs {s.net_pay}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DetailSection>
        </>
      ) : null}
    </DetailShell>
  );
}
