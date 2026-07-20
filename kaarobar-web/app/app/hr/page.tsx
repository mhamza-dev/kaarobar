"use client";

import { useCallback, useEffect, useState } from "react";
import { api, getSession } from "@/lib/api/client";
import Modal from "@/components/modals/Modal";
import Button from "@/components/ui/Button";
import {
  Alert,
  EmptyState,
  Field,
  PageHeader,
  SurfaceCard,
  TabBar,
  fieldClass,
} from "@/components/app/ui";

type Tab = "employees" | "attendance" | "leave" | "payroll";
type ModalKind = "employee" | "invite" | "payroll" | null;

type Employee = {
  id: string;
  employee_code: string;
  name: string;
  position?: string;
  basic_salary: string;
  status: string;
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
  const [modal, setModal] = useState<ModalKind>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [leave, setLeave] = useState<Leave[]>([]);
  const [payroll, setPayroll] = useState<PayrollRun[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [empForm, setEmpForm] = useState({
    employee_code: "",
    name: "",
    position: "Cashier",
    basic_salary: "30000",
    transport: "3000",
  });
  const [inviteForm, setInviteForm] = useState({
    email: "",
    roles: "cashier",
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
    setBusy(true);
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
      setModal(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  async function inviteStaff(ev: React.FormEvent) {
    ev.preventDefault();
    const session = getSession();
    if (!session?.business_id) {
      setError("Select a business first from the dashboard.");
      return;
    }
    setBusy(true);
    try {
      await api(`/businesses/${session.business_id}/memberships`, {
        method: "POST",
        body: JSON.stringify({
          email: inviteForm.email.trim(),
          roles: [inviteForm.roles],
          branch_id: session.branch_id,
          status: "active",
        }),
      });
      setMessage(`Invited ${inviteForm.email} as ${inviteForm.roles}`);
      setInviteForm({ email: "", roles: "cashier" });
      setModal(null);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Invite failed — user must already have a Kaarobar account"
      );
    } finally {
      setBusy(false);
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
    setBusy(true);
    try {
      await api("/payroll", {
        method: "POST",
        body: JSON.stringify({
          period_start: periodStart,
          period_end: periodEnd,
        }),
      });
      setMessage("Payroll draft created");
      setModal(null);
      setTab("payroll");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payroll failed");
    } finally {
      setBusy(false);
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
      <PageHeader
        eyebrow="People"
        title="HR & payroll"
        description="Employees, attendance, leave approvals, and payroll that posts into the ledger."
        action={
          tab === "employees"
            ? { label: "Add employee", onClick: () => setModal("employee") }
            : tab === "payroll"
              ? { label: "Draft payroll", onClick: () => setModal("payroll") }
              : undefined
        }
        secondaryAction={
          tab === "employees"
            ? { label: "Invite staff", onClick: () => setModal("invite") }
            : undefined
        }
      />

      <TabBar tabs={tabs} value={tab} onChange={setTab} />

      {error ? <Alert tone="error">{error}</Alert> : null}
      {message ? <Alert tone="success">{message}</Alert> : null}

      {tab === "employees" ? (
        <SurfaceCard>
          <table className="w-full text-left text-sm">
            <thead className="bg-brand-subtle">
              <tr>
                <th className="px-4 py-3 font-semibold">Code</th>
                <th className="px-4 py-3 font-semibold">Name</th>
                <th className="px-4 py-3 font-semibold">Position</th>
                <th className="px-4 py-3 font-semibold">Basic</th>
                <th className="px-4 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {employees.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <EmptyState
                      title="No employees yet"
                      body="Add an employee record or invite an existing Kaarobar user."
                    />
                  </td>
                </tr>
              ) : (
                employees.map((e) => (
                  <tr key={e.id} className="border-t border-border text-heading">
                    <td className="px-4 py-3">{e.employee_code}</td>
                    <td className="px-4 py-3">{e.name}</td>
                    <td className="px-4 py-3">{e.position || "—"}</td>
                    <td className="px-4 py-3">{e.basic_salary}</td>
                    <td className="px-4 py-3">{e.status}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </SurfaceCard>
      ) : null}

      {tab === "attendance" ? (
        <SurfaceCard>
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
                  <td colSpan={5}>
                    <EmptyState
                      title="No attendance yet"
                      body="Staff clock in from the mobile ESS."
                    />
                  </td>
                </tr>
              ) : (
                attendance.map((a) => (
                  <tr key={a.id} className="border-t border-border text-heading">
                    <td className="px-4 py-3">{a.date}</td>
                    <td className="px-4 py-3">{a.employee_name || "—"}</td>
                    <td className="px-4 py-3">
                      {a.clock_in ? new Date(a.clock_in).toLocaleTimeString() : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {a.clock_out ? new Date(a.clock_out).toLocaleTimeString() : "—"}
                    </td>
                    <td className="px-4 py-3">{a.source}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </SurfaceCard>
      ) : null}

      {tab === "leave" ? (
        <div className="space-y-3">
          {leave.length === 0 ? (
            <SurfaceCard>
              <EmptyState title="No leave requests" />
            </SurfaceCard>
          ) : (
            leave.map((l) => (
              <SurfaceCard
                key={l.id}
                className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm"
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
                    <Button size="sm" onClick={() => decideLeave(l.id, "approve")}>
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => decideLeave(l.id, "reject")}
                    >
                      Reject
                    </Button>
                  </div>
                ) : null}
              </SurfaceCard>
            ))
          )}
        </div>
      ) : null}

      {tab === "payroll" ? (
        <div className="space-y-4">
          {payroll.map((run) => (
            <SurfaceCard key={run.id} className="space-y-3 p-4">
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
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => payrollAction(run.id, "submit")}
                    >
                      Submit
                    </Button>
                  ) : null}
                  {run.status === "PendingApproval" ? (
                    <>
                      <Button size="sm" onClick={() => payrollAction(run.id, "approve")}>
                        Approve & post
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => payrollAction(run.id, "reject")}
                      >
                        Reject
                      </Button>
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
                      <td className="py-2">
                        {s.employee_name || s.employee_code || s.id.slice(0, 8)}
                      </td>
                      <td className="py-2">{s.days_worked}</td>
                      <td className="py-2">{s.overtime_hours}</td>
                      <td className="py-2">{s.gross_pay}</td>
                      <td className="py-2">{s.net_pay}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </SurfaceCard>
          ))}
          {payroll.length === 0 ? (
            <SurfaceCard>
              <EmptyState
                title="No payroll runs"
                body="Draft a run for the current period to generate payslips."
              />
            </SurfaceCard>
          ) : null}
        </div>
      ) : null}

      <Modal
        isOpen={modal === "employee"}
        onClose={() => setModal(null)}
        title="Add employee"
        description="Create a payroll record for someone at the active branch."
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setModal(null)}>
              Cancel
            </Button>
            <Button type="submit" form="employee-modal-form" loading={busy}>
              Save employee
            </Button>
          </div>
        }
      >
        <form id="employee-modal-form" onSubmit={createEmployee} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Employee code">
              <input
                className={fieldClass}
                value={empForm.employee_code}
                onChange={(e) =>
                  setEmpForm({ ...empForm, employee_code: e.target.value })
                }
                required
              />
            </Field>
            <Field label="Full name">
              <input
                className={fieldClass}
                value={empForm.name}
                onChange={(e) => setEmpForm({ ...empForm, name: e.target.value })}
                required
              />
            </Field>
            <Field label="Position">
              <input
                className={fieldClass}
                value={empForm.position}
                onChange={(e) => setEmpForm({ ...empForm, position: e.target.value })}
              />
            </Field>
            <Field label="Basic salary">
              <input
                className={fieldClass}
                value={empForm.basic_salary}
                onChange={(e) =>
                  setEmpForm({ ...empForm, basic_salary: e.target.value })
                }
              />
            </Field>
            <Field label="Transport allowance">
              <input
                className={fieldClass}
                value={empForm.transport}
                onChange={(e) => setEmpForm({ ...empForm, transport: e.target.value })}
              />
            </Field>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={modal === "invite"}
        onClose={() => setModal(null)}
        title="Invite staff"
        description="Grant access to someone who already has a Kaarobar login (e.g. cashier@…)."
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setModal(null)}>
              Cancel
            </Button>
            <Button type="submit" form="invite-modal-form" loading={busy}>
              Send invite
            </Button>
          </div>
        }
      >
        <form id="invite-modal-form" onSubmit={inviteStaff} className="space-y-4">
          <Field label="Email">
            <input
              type="email"
              className={fieldClass}
              value={inviteForm.email}
              onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
              placeholder="cashier@kaarobar.local"
              required
            />
          </Field>
          <Field label="Role">
            <select
              className={fieldClass}
              value={inviteForm.roles}
              onChange={(e) => setInviteForm({ ...inviteForm, roles: e.target.value })}
            >
              {[
                "cashier",
                "branch_manager",
                "inventory_manager",
                "accountant",
                "hr_manager",
                "employee",
              ].map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </Field>
        </form>
      </Modal>

      <Modal
        isOpen={modal === "payroll"}
        onClose={() => setModal(null)}
        title="Draft payroll"
        description="Payslips are calculated from salary, attendance, and statutory deductions."
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setModal(null)}>
              Cancel
            </Button>
            <Button type="submit" form="payroll-modal-form" loading={busy}>
              Create draft
            </Button>
          </div>
        }
      >
        <form id="payroll-modal-form" onSubmit={createPayroll} className="grid gap-4 sm:grid-cols-2">
          <Field label="Period start">
            <input
              type="date"
              className={fieldClass}
              value={periodStart}
              onChange={(e) => setPeriodStart(e.target.value)}
            />
          </Field>
          <Field label="Period end">
            <input
              type="date"
              className={fieldClass}
              value={periodEnd}
              onChange={(e) => setPeriodEnd(e.target.value)}
            />
          </Field>
        </form>
      </Modal>
    </div>
  );
}
