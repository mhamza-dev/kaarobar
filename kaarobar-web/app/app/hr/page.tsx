"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api/client";

type Tab = "employees" | "attendance" | "leave" | "payroll";

type Employee = {
  id: string;
  employee_code: string;
  name: string;
  position?: string;
  basic_salary: string;
  allowances?: Record<string, string>;
  status: string;
  branch_id: string;
  phone?: string;
};

type Attendance = {
  id: string;
  employee_name?: string;
  date: string;
  clock_in?: string;
  clock_out?: string;
  source: string;
};

type Leave = {
  id: string;
  employee_name?: string;
  type: string;
  start_date: string;
  end_date: string;
  status: string;
  reason?: string;
};

type Payslip = {
  id: string;
  employee_name?: string;
  employee_code?: string;
  gross_pay: string;
  net_pay: string;
  deductions?: Record<string, string>;
  days_worked?: string;
  overtime_hours?: string;
};

type PayrollRun = {
  id: string;
  period_start: string;
  period_end: string;
  status: string;
  journal_entry_id?: string;
  payslips: Payslip[];
};

export default function HrPage() {
  const [tab, setTab] = useState<Tab>("employees");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [leave, setLeave] = useState<Leave[]>([]);
  const [payroll, setPayroll] = useState<PayrollRun[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [empForm, setEmpForm] = useState({
    employee_code: "",
    name: "",
    position: "Cashier",
    basic_salary: "30000",
    transport: "3000",
  });

  const [periodStart, setPeriodStart] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  });
  const [periodEnd, setPeriodEnd] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );

  const load = useCallback(async () => {
    setError(null);
    try {
      const [e, a, l, p] = await Promise.all([
        api<{ data: Employee[] }>("/employees"),
        api<{ data: Attendance[] }>("/attendance"),
        api<{ data: Leave[] }>("/leave"),
        api<{ data: PayrollRun[] }>("/payroll"),
      ]);
      setEmployees(e.data || []);
      setAttendance(a.data || []);
      setLeave(l.data || []);
      setPayroll(p.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load HR");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function createEmployee(ev: React.FormEvent) {
    ev.preventDefault();
    try {
      await api("/employees", {
        method: "POST",
        body: JSON.stringify({
          employee_code: empForm.employee_code,
          name: empForm.name,
          position: empForm.position,
          join_date: new Date().toISOString().slice(0, 10),
          basic_salary: empForm.basic_salary,
          allowances: { transport: empForm.transport },
          status: "active",
        }),
      });
      setMessage("Employee created");
      setEmpForm({
        employee_code: "",
        name: "",
        position: "Cashier",
        basic_salary: "30000",
        transport: "3000",
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    }
  }

  async function decideLeave(id: string, action: "approve" | "reject") {
    try {
      await api(`/leave/${id}/${action}`, { method: "POST", body: "{}" });
      setMessage(`Leave ${action}d`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Leave action failed");
    }
  }

  async function createPayroll(ev: React.FormEvent) {
    ev.preventDefault();
    try {
      await api("/payroll", {
        method: "POST",
        body: JSON.stringify({
          period_start: periodStart,
          period_end: periodEnd,
        }),
      });
      setMessage("Payroll draft created");
      setTab("payroll");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payroll failed");
    }
  }

  async function payrollAction(id: string, action: "submit" | "approve" | "reject") {
    try {
      await api(`/payroll/${id}/${action}`, { method: "POST", body: "{}" });
      setMessage(`Payroll ${action}`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payroll action failed");
    }
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "employees", label: "Employees" },
    { id: "attendance", label: "Attendance" },
    { id: "leave", label: "Leave" },
    { id: "payroll", label: "Payroll" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-heading">HR & Payroll</h1>
        <p className="text-body">
          Employees, attendance, leave approvals, and payroll that posts to the ledger.
        </p>
      </div>

      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      {message ? <p className="text-sm text-body">{message}</p> : null}

      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-lg px-3 py-1.5 text-sm ${
              tab === t.id
                ? "bg-brand text-brand-foreground"
                : "border border-border text-heading hover:border-brand"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "employees" ? (
        <div className="space-y-4">
          <form
            onSubmit={createEmployee}
            className="grid gap-3 rounded-xl border border-border bg-card p-4 md:grid-cols-3"
          >
            <input
              className="rounded-lg border border-border px-3 py-2"
              placeholder="Code"
              value={empForm.employee_code}
              onChange={(e) =>
                setEmpForm({ ...empForm, employee_code: e.target.value })
              }
              required
            />
            <input
              className="rounded-lg border border-border px-3 py-2"
              placeholder="Name"
              value={empForm.name}
              onChange={(e) => setEmpForm({ ...empForm, name: e.target.value })}
              required
            />
            <input
              className="rounded-lg border border-border px-3 py-2"
              placeholder="Position"
              value={empForm.position}
              onChange={(e) =>
                setEmpForm({ ...empForm, position: e.target.value })
              }
            />
            <input
              className="rounded-lg border border-border px-3 py-2"
              placeholder="Basic salary"
              value={empForm.basic_salary}
              onChange={(e) =>
                setEmpForm({ ...empForm, basic_salary: e.target.value })
              }
            />
            <input
              className="rounded-lg border border-border px-3 py-2"
              placeholder="Transport allowance"
              value={empForm.transport}
              onChange={(e) =>
                setEmpForm({ ...empForm, transport: e.target.value })
              }
            />
            <button
              type="submit"
              className="rounded-lg bg-brand px-4 py-2 font-semibold text-brand-foreground"
            >
              Add employee
            </button>
          </form>

          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <table className="w-full text-left text-sm">
              <thead className="bg-brand-subtle">
                <tr>
                  <th className="px-4 py-3">Code</th>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Position</th>
                  <th className="px-4 py-3">Basic</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((e) => (
                  <tr key={e.id} className="border-t border-border text-heading">
                    <td className="px-4 py-2">{e.employee_code}</td>
                    <td className="px-4 py-2">{e.name}</td>
                    <td className="px-4 py-2">{e.position || "—"}</td>
                    <td className="px-4 py-2">{e.basic_salary}</td>
                    <td className="px-4 py-2">{e.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {tab === "attendance" ? (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-left text-sm">
            <thead className="bg-brand-subtle">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Employee</th>
                <th className="px-4 py-3">In</th>
                <th className="px-4 py-3">Out</th>
                <th className="px-4 py-3">Source</th>
              </tr>
            </thead>
            <tbody>
              {attendance.length === 0 ? (
                <tr>
                  <td className="px-4 py-3 text-body" colSpan={5}>
                    No attendance yet — staff clock in from mobile ESS.
                  </td>
                </tr>
              ) : (
                attendance.map((a) => (
                  <tr key={a.id} className="border-t border-border text-heading">
                    <td className="px-4 py-2">{a.date}</td>
                    <td className="px-4 py-2">{a.employee_name || "—"}</td>
                    <td className="px-4 py-2">
                      {a.clock_in ? new Date(a.clock_in).toLocaleTimeString() : "—"}
                    </td>
                    <td className="px-4 py-2">
                      {a.clock_out
                        ? new Date(a.clock_out).toLocaleTimeString()
                        : "—"}
                    </td>
                    <td className="px-4 py-2">{a.source}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : null}

      {tab === "leave" ? (
        <div className="space-y-3">
          {leave.length === 0 ? (
            <p className="text-body">No leave requests.</p>
          ) : (
            leave.map((l) => (
              <div
                key={l.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 text-sm"
              >
                <div className="text-heading">
                  <strong>{l.employee_name || "Employee"}</strong> · {l.type} ·{" "}
                  {l.start_date} → {l.end_date}
                  <div className="text-body">
                    {l.status}
                    {l.reason ? ` · ${l.reason}` : ""}
                  </div>
                </div>
                {l.status === "Pending" ? (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => decideLeave(l.id, "approve")}
                      className="rounded-lg bg-brand px-3 py-1.5 text-brand-foreground"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => decideLeave(l.id, "reject")}
                      className="rounded-lg border border-border px-3 py-1.5"
                    >
                      Reject
                    </button>
                  </div>
                ) : null}
              </div>
            ))
          )}
        </div>
      ) : null}

      {tab === "payroll" ? (
        <div className="space-y-4">
          <form
            onSubmit={createPayroll}
            className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4"
          >
            <label className="text-sm text-heading">
              From{" "}
              <input
                type="date"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
                className="ml-1 rounded border border-border px-2 py-1"
              />
            </label>
            <label className="text-sm text-heading">
              To{" "}
              <input
                type="date"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
                className="ml-1 rounded border border-border px-2 py-1"
              />
            </label>
            <button
              type="submit"
              className="rounded-lg bg-brand px-4 py-2 font-semibold text-brand-foreground"
            >
              Draft payroll
            </button>
          </form>

          {payroll.map((run) => (
            <div
              key={run.id}
              className="space-y-3 rounded-xl border border-border bg-card p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-heading">
                  <strong>
                    {run.period_start} → {run.period_end}
                  </strong>{" "}
                  <span className="text-body">· {run.status}</span>
                  {run.journal_entry_id ? (
                    <span className="text-body"> · posted to ledger</span>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  {run.status === "Draft" || run.status === "Rejected" ? (
                    <button
                      type="button"
                      onClick={() => payrollAction(run.id, "submit")}
                      className="rounded border border-border px-3 py-1 text-sm"
                    >
                      Submit
                    </button>
                  ) : null}
                  {run.status === "PendingApproval" ? (
                    <>
                      <button
                        type="button"
                        onClick={() => payrollAction(run.id, "approve")}
                        className="rounded bg-brand px-3 py-1 text-sm text-brand-foreground"
                      >
                        Approve & post
                      </button>
                      <button
                        type="button"
                        onClick={() => payrollAction(run.id, "reject")}
                        className="rounded border border-border px-3 py-1 text-sm"
                      >
                        Reject
                      </button>
                    </>
                  ) : null}
                </div>
              </div>
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-body">
                    <th className="py-1">Employee</th>
                    <th className="py-1">Days</th>
                    <th className="py-1">OT hrs</th>
                    <th className="py-1">Gross</th>
                    <th className="py-1">Net</th>
                  </tr>
                </thead>
                <tbody>
                  {run.payslips?.map((s) => (
                    <tr key={s.id} className="border-t border-border text-heading">
                      <td className="py-1">
                        {s.employee_name || s.employee_code || s.id.slice(0, 8)}
                      </td>
                      <td className="py-1">{s.days_worked}</td>
                      <td className="py-1">{s.overtime_hours}</td>
                      <td className="py-1">{s.gross_pay}</td>
                      <td className="py-1">{s.net_pay}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
