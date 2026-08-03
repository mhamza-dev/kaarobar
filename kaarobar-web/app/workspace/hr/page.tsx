"use client";

import { Fragment, Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, getSession } from "@/lib/api/client";
import Modal from "@/components/modals/Modal";
import Button from "@/components/ui/Button";
import DataTable from "@/components/ui/DataTable";
import ActionMenu from "@/components/ui/ActionMenu";
import Select from "@/components/ui/Select";
import {
  EmptyState,
  Field,
  PageHeader,
  SurfaceCard,
  TabBar,
  fieldClass,
} from "@/components/app/ui";
import { useToast } from "@/components/ui/Toast";
import { useT } from "@/lib/i18n";
import { formatDecimal } from "@/lib/decimal";
import { useTabQueryParam } from "@/lib/hooks/useTabQueryParam";
import { detailRoutes, routes } from "@/lib/navigation";
import { canAccessBundle } from "@/lib/rbac";
import {
  emptyStaffListFilters,
  type ListFilterConfig,
  type StaffListFilterState,
} from "@/lib/listFilters";
import { hrKeys } from "@/lib/queryClient";

type Tab = "employees" | "attendance" | "leave" | "payroll";
const HR_TABS: readonly Tab[] = ["employees", "attendance", "leave", "payroll"];
type ModalKind = "employee" | "invite" | "payroll" | null;

const emptyEmpForm = {
  employee_code: "",
  name: "",
  position: "Cashier",
  basic_salary: "30000",
  transport: "3000",
  status: "active",
};

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
  earnings?: Record<string, string>;
  deductions?: Record<string, string>;
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
  return (
    <Suspense fallback={<p className="text-sm text-body">Loading…</p>}>
      <HrPageInner />
    </Suspense>
  );
}

function HrPageInner() {
  const t = useT();
  const toast = useToast();
  const router = useRouter();
  const queryClient = useQueryClient();
  const session = getSession();
  const businessId = session?.business_id ?? null;
  const canLeaveApprove = canAccessBundle(session, "leave_approve");
  const canPayrollApprove = canAccessBundle(session, "payroll_approve");
  const canSeePayroll = canPayrollApprove;
  const [tab, setTab] = useTabQueryParam<Tab>("employees", HR_TABS, {
    basePath: routes.hr,
    isAllowed: (next) => next !== "payroll" || canSeePayroll,
  });
  const [modal, setModal] = useState<ModalKind>(null);
  const [editingEmployeeId, setEditingEmployeeId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [attendanceFilters, setAttendanceFilters] = useState<StaffListFilterState>(
    emptyStaffListFilters()
  );
  const [leaveFilters, setLeaveFilters] = useState<StaffListFilterState>(
    emptyStaffListFilters()
  );

  const [empForm, setEmpForm] = useState(emptyEmpForm);
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

  const attendanceParams = useMemo(() => {
    const attParams = new URLSearchParams();
    if (attendanceFilters.from.trim()) attParams.set("from", attendanceFilters.from.trim());
    if (attendanceFilters.to.trim()) attParams.set("to", attendanceFilters.to.trim());
    return attParams.toString();
  }, [attendanceFilters.from, attendanceFilters.to]);

  const leaveParams = useMemo(() => {
    const leaveParams = new URLSearchParams();
    if (leaveFilters.statuses.length === 1) {
      leaveParams.set("status", leaveFilters.statuses[0]);
    }
    return leaveParams.toString();
  }, [leaveFilters.statuses]);

  const {
    data: employees = [],
    isLoading: employeesLoading,
    isFetching: employeesFetching,
  } = useQuery({
    queryKey: hrKeys.employees(businessId),
    queryFn: async () => {
      const res = await api<{ data: Employee[] }>("/employees");
      return res.data || [];
    },
    enabled: tab === "employees",
  });

  const {
    data: attendance = [],
    isLoading: attendanceLoading,
    isFetching: attendanceFetching,
  } = useQuery({
    queryKey: hrKeys.attendance(businessId, attendanceParams),
    queryFn: async () => {
      const qs = attendanceParams ? `?${attendanceParams}` : "";
      const res = await api<{ data: Attendance[] }>(`/attendance${qs}`);
      return res.data || [];
    },
    enabled: tab === "attendance",
  });

  const {
    data: leave = [],
    isLoading: leaveLoading,
    isFetching: leaveFetching,
  } = useQuery({
    queryKey: hrKeys.leave(businessId, leaveParams),
    queryFn: async () => {
      const qs = leaveParams ? `?${leaveParams}` : "";
      const res = await api<{ data: Leave[] }>(`/leave${qs}`);
      return res.data || [];
    },
    enabled: tab === "leave" && canLeaveApprove,
  });

  const { data: payroll = [] } = useQuery({
    queryKey: hrKeys.payroll(businessId),
    queryFn: async () => {
      const res = await api<{ data: PayrollRun[] }>("/payroll");
      return res.data || [];
    },
    enabled: tab === "payroll" && canSeePayroll,
  });

  async function refreshHr() {
    await queryClient.invalidateQueries({ queryKey: hrKeys.all });
  }

  const attendanceFilterConfig = useMemo<ListFilterConfig>(
    () => ({
      showDateRange: true,
      categoryLabel: t("listFilters.source"),
      categoryOptions: [
        { value: "mobile", label: "Mobile" },
        { value: "web", label: "Web" },
        { value: "desktop", label: "Desktop" },
      ],
    }),
    [t]
  );

  const leaveFilterConfig = useMemo<ListFilterConfig>(
    () => ({
      showDateRange: true,
      statusOptions: [
        { value: "Pending", label: "Pending" },
        { value: "Approved", label: "Approved" },
        { value: "Rejected", label: "Rejected" },
      ],
    }),
    []
  );

  useEffect(() => {
    if (tab === "payroll" && !canSeePayroll) setTab("employees");
  }, [tab, canSeePayroll, setTab]);

  function openNewEmployee() {
    setEditingEmployeeId(null);
    setEmpForm(emptyEmpForm);
    setModal("employee");
  }

  function openEditEmployee(e: Employee) {
    setEditingEmployeeId(e.id);
    setEmpForm({
      employee_code: e.employee_code || "",
      name: e.name || "",
      position: e.position || "Cashier",
      basic_salary: e.basic_salary || "",
      transport: "3000",
      status: e.status || "active",
    });
    setModal("employee");
  }

  function closeEmployeeModal() {
    setModal(null);
    setEditingEmployeeId(null);
    setEmpForm(emptyEmpForm);
  }

  async function saveEmployee(ev: React.FormEvent) {
    ev.preventDefault();
    setBusy(true);
    try {
      const payload = {
        employee_code: empForm.employee_code,
        name: empForm.name,
        position: empForm.position,
        basic_salary: empForm.basic_salary,
        allowances: { transport: empForm.transport },
        status: empForm.status,
      };

      if (editingEmployeeId) {
        await api(`/employees/${editingEmployeeId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        toast.success(t("hr.employeeUpdated"));
      } else {
        await api("/employees", {
          method: "POST",
          body: JSON.stringify({
            ...payload,
            join_date: new Date().toISOString().slice(0, 10),
          }),
        });
        toast.success(t("hr.employeeCreated"));
      }
      closeEmployeeModal();
      await refreshHr();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.saveFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function inviteStaff(ev: React.FormEvent) {
    ev.preventDefault();
    const session = getSession();
    if (!session?.business_id) {
      toast.warning(t("tenant.noBusinesses"));
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
      toast.success(t("hr.inviteSent"));
      setInviteForm({ email: "", roles: "cashier" });
      setModal(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  async function decideLeave(id: string, action: "approve" | "reject") {
    try {
      await api(`/leave/${id}/${action}`, { method: "POST", body: "{}" });
      toast.success(action === "approve" ? t("hr.leaveApproved") : t("hr.leaveRejected"));
      await refreshHr();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
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
      toast.success(t("hr.payrollRun"));
      setModal(null);
      setTab("payroll");
      await refreshHr();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  async function payrollAction(id: string, action: "submit" | "approve" | "reject" | "recalculate") {
    try {
      await api(`/payroll/${id}/${action}`, { method: "POST", body: "{}" });
      toast.success(
        action === "recalculate" ? "Payroll recalculated from attendance" : t("common.success")
      );
      await refreshHr();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    }
  }

  const tabs: { id: Tab; label: string; infoKey?: string }[] = [
    { id: "employees", label: t("hr.tabs.employees"), infoKey: "tab.hr.employees" },
    { id: "attendance", label: t("hr.tabs.attendance"), infoKey: "tab.hr.attendance" },
    { id: "leave", label: t("hr.tabs.leave"), infoKey: "tab.hr.leave" },
    ...(canSeePayroll
      ? [{ id: "payroll" as const, label: t("hr.tabs.payroll"), infoKey: "tab.hr.payroll" }]
      : []),
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t("hr.eyebrow")}
        title={t("pages.hrTitle")}
        description={t("pages.hrDesc")}
        infoKey="page.hr"
        action={
          tab === "employees"
            ? { label: t("hr.addEmployee"), onClick: openNewEmployee }
            : tab === "payroll"
              ? { label: t("hr.runPayroll"), onClick: () => setModal("payroll") }
              : undefined
        }
        secondaryAction={
          tab === "employees"
            ? { label: t("hr.inviteUser"), onClick: () => setModal("invite") }
            : undefined
        }
      />

      <TabBar tabs={tabs} value={tab} onChange={setTab} />

      {tab === "employees" ? (
        <DataTable
          maxHeight="28rem"
          loading={employeesLoading || employeesFetching}
          searchable
          searchPlaceholder={t("hr.searchEmployees")}
          getSearchText={(e) =>
            `${e.employee_code} ${e.name} ${e.position ?? ""} ${e.status}`
          }
          onRowClick={(e) => router.push(detailRoutes.employee(e.id))}
          columns={[
            {
              id: "code",
              header: "Code",
              cell: (e) => (
                <Link
                  href={detailRoutes.employee(e.id)}
                  className="font-medium tabular-nums text-brand underline"
                  onClick={(ev) => ev.stopPropagation()}
                >
                  {e.employee_code}
                </Link>
              ),
            },
            {
              id: "name",
              header: "Name",
              cell: (e) => <span className="font-medium">{e.name}</span>,
            },
            {
              id: "position",
              header: "Position",
              cell: (e) => e.position || "—",
            },
            {
              id: "basic",
              header: "Basic",
              align: "right",
              cell: (e) => <span className="tabular-nums">{formatDecimal(e.basic_salary)}</span>,
            },
            {
              id: "status",
              header: "Status",
              cell: (e) => (
                <span className="inline-flex rounded-md bg-bg-tertiary px-2 py-0.5 text-xs font-semibold capitalize">
                  {e.status}
                </span>
              ),
            },
            {
              id: "actions",
              header: "",
              align: "right",
              width: 56,
              cell: (e) => (
                <div className="flex justify-end">
                  <ActionMenu
                    items={[
                      {
                        id: "view",
                        label: "View",
                        onClick: () => router.push(detailRoutes.employee(e.id)),
                      },
                      {
                        id: "edit",
                        label: "Edit",
                        onClick: () => openEditEmployee(e),
                      },
                    ]}
                  />
                </div>
              ),
            },
          ]}
          data={employees}
          rowKey={(e) => e.id}
          emptyTitle="No employees yet"
          emptyBody="Add an employee record or invite an existing Kaarobar user."
        />
      ) : null}

      {tab === "attendance" ? (
        <DataTable
          maxHeight="28rem"
          filterState={attendanceFilters}
          onFilterChange={setAttendanceFilters}
          filterConfig={attendanceFilterConfig}
          filterAccessors={{
            searchText: (a) =>
              `${a.employee_name || ""} ${a.date} ${a.source || ""}`,
            date: (a) => a.date,
            category: (a) => a.source || "",
          }}
          clientFilter
          searchPlaceholder={t("hr.searchAttendance")}
          pagination={{ mode: "client", pageSize: 25 }}
          exportable
          exportFilename="attendance"
          exportTitle="Attendance"
          loading={attendanceLoading || attendanceFetching}
          columns={[
            { id: "date", header: "Date", cell: (a) => a.date },
            {
              id: "employee",
              header: "Employee",
              cell: (a) => a.employee_name || "—",
            },
            {
              id: "in",
              header: "In",
              cell: (a) =>
                a.clock_in ? new Date(a.clock_in).toLocaleTimeString() : "—",
            },
            {
              id: "out",
              header: "Out",
              cell: (a) =>
                a.clock_out ? new Date(a.clock_out).toLocaleTimeString() : "—",
            },
            { id: "source", header: "Source", cell: (a) => a.source },
          ]}
          data={attendance}
          rowKey={(a) => a.id}
          emptyTitle="No attendance yet"
          emptyBody="Staff clock in from the mobile ESS."
        />
      ) : null}

      {tab === "leave" ? (
        <DataTable
          maxHeight="28rem"
          filterState={leaveFilters}
          onFilterChange={setLeaveFilters}
          filterConfig={leaveFilterConfig}
          filterAccessors={{
            searchText: (l) =>
              `${l.employee_name || ""} ${l.type} ${l.status} ${l.reason || ""}`,
            date: (l) => l.start_date,
            status: (l) => l.status,
          }}
          clientFilter
          searchPlaceholder={t("hr.searchLeave")}
          pagination={{ mode: "client", pageSize: 25 }}
          exportable
          exportFilename="leave"
          exportTitle="Leave"
          loading={leaveLoading || leaveFetching}
          columns={[
            {
              id: "employee",
              header: "Employee",
              cell: (l) => (
                <span className="font-medium">{l.employee_name || "Employee"}</span>
              ),
            },
            { id: "type", header: "Type", cell: (l) => l.type },
            {
              id: "dates",
              header: "Dates",
              cell: (l) => `${l.start_date} → ${l.end_date}`,
            },
            { id: "status", header: "Status", cell: (l) => l.status },
            {
              id: "actions",
              header: "",
              align: "right",
              width: 160,
              cell: (l) =>
                l.status === "Pending" && canLeaveApprove ? (
                  <div className="flex justify-end gap-2">
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
                ) : null,
            },
          ]}
          data={leave}
          rowKey={(l) => l.id}
          emptyTitle="No leave requests"
        />
      ) : null}

      {tab === "payroll" ? (
        <div className="max-h-[min(80vh,42rem)] space-y-4 overflow-y-auto">
          <p className="text-sm text-body">
            Pay is computed from clocked hours and approved leave (Mon–Sat × 8h). Incomplete shifts
            do not count until clock-out.
          </p>
          {payroll.map((run) => (
            <SurfaceCard key={run.id} className="space-y-3 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-heading">
                  <Link
                    href={detailRoutes.payroll(run.id)}
                    className="font-semibold text-brand underline"
                  >
                    {run.period_start} → {run.period_end}
                  </Link>{" "}
                  <span className="text-body">· {run.status}</span>
                  {run.journal_entry_id ? (
                    <span className="text-body"> · posted to ledger</span>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  {run.status === "Draft" || run.status === "Rejected" ? (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => payrollAction(run.id, "recalculate")}
                      >
                        Recalculate
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => payrollAction(run.id, "submit")}
                      >
                        Submit
                      </Button>
                    </>
                  ) : null}
                  {run.status === "PendingApproval" && canPayrollApprove ? (
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
                    <th className="py-1">Hours</th>
                    <th className="py-1">OT</th>
                    <th className="py-1">Factor</th>
                    <th className="py-1">Gross</th>
                    <th className="py-1">Net</th>
                  </tr>
                </thead>
                <tbody>
                  {run.payslips?.map((s) => (
                    <Fragment key={s.id}>
                      <tr className="border-t border-border text-heading">
                        <td className="py-2">
                          {s.employee_name || s.employee_code || s.id.slice(0, 8)}
                        </td>
                        <td className="py-2">{s.days_worked ?? "—"}</td>
                        <td className="py-2">{s.earnings?.worked_hours ?? "—"}</td>
                        <td className="py-2">{s.overtime_hours ?? s.earnings?.ot_hours ?? "—"}</td>
                        <td className="py-2">{s.earnings?.attendance_factor ?? "—"}</td>
                        <td className="py-2 tabular-nums">{formatDecimal(s.gross_pay)}</td>
                        <td className="py-2 tabular-nums">{formatDecimal(s.net_pay)}</td>
                      </tr>
                      {s.earnings || s.deductions ? (
                        <tr className="border-t border-border/60 text-xs text-body">
                          <td colSpan={7} className="pb-3 pt-0">
                            {s.earnings ? (
                              <span>
                                Credited {s.earnings.credited_hours ?? "—"}h / expected{" "}
                                {s.earnings.expected_hours ?? "—"}h · leave{" "}
                                {s.earnings.leave_hours ?? "0"}h · base {s.earnings.base_pay != null ? formatDecimal(s.earnings.base_pay) : "—"}{" "}
                                · OT pay {formatDecimal(s.earnings.overtime_pay ?? "0")}
                              </span>
                            ) : null}
                            {s.deductions ? (
                              <span className="ml-2">
                                · Tax {formatDecimal(s.deductions.income_tax ?? "0")} · EOBI{" "}
                                {formatDecimal(s.deductions.eobi ?? "0")}
                              </span>
                            ) : null}
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
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
        onClose={closeEmployeeModal}
        title={editingEmployeeId ? "Edit employee" : "Add employee"}
        description={
          editingEmployeeId
            ? "Update payroll details and employment status."
            : "Create a payroll record for someone at the active branch."
        }
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={closeEmployeeModal}>
              Cancel
            </Button>
            <Button type="submit" form="employee-modal-form" loading={busy}>
              {editingEmployeeId ? "Save changes" : "Save employee"}
            </Button>
          </div>
        }
      >
        <form id="employee-modal-form" onSubmit={saveEmployee} className="space-y-4">
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
                type="number"
                step="0.01"
                value={empForm.basic_salary}
                onChange={(e) =>
                  setEmpForm({ ...empForm, basic_salary: e.target.value })
                }
                onBlur={(e) => {
                  if (e.target.value.trim() === "") return;
                  setEmpForm({
                    ...empForm,
                    basic_salary: formatDecimal(e.target.value),
                  });
                }}
              />
            </Field>
            <Field label="Transport allowance">
              <input
                className={fieldClass}
                type="number"
                step="0.01"
                value={empForm.transport}
                onChange={(e) => setEmpForm({ ...empForm, transport: e.target.value })}
                onBlur={(e) => {
                  if (e.target.value.trim() === "") return;
                  setEmpForm({
                    ...empForm,
                    transport: formatDecimal(e.target.value),
                  });
                }}
              />
            </Field>
            {editingEmployeeId ? (
              <Field label="Status">
                <Select
                  value={empForm.status}
                  onChange={(v) => setEmpForm({ ...empForm, status: v })}
                  options={[
                    { value: "active", label: "Active" },
                    { value: "inactive", label: "Inactive" },
                    { value: "terminated", label: "Terminated" },
                  ]}
                />
              </Field>
            ) : null}
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
            <Select
              value={inviteForm.roles}
              onChange={(v) => setInviteForm({ ...inviteForm, roles: v })}
              options={[
                "cashier",
                "branch_manager",
                "inventory_manager",
                "accountant",
                "hr_manager",
                "employee",
              ].map((r) => ({ value: r, label: r }))}
            />
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
