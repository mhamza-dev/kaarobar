import { Fragment, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronDown, Play, RefreshCw, Send, UserPlus, UserRoundPlus, X } from "lucide-react";
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
  StatusBadge,
  SurfaceCard,
  TabBar,
  fieldClass,
} from "@/components/app/ui";
import { useToast } from "@/components/ui/Toast";
import { useT } from "@/lib/i18n";
import { useTabQueryParam } from "@/lib/hooks/useTabQueryParam";
import { detailRoutes, routes } from "@/lib/navigation";
import { canAccessBundle } from "@/lib/rbac";
import {
  emptyStaffListFilters,
  type ListFilterConfig,
  type StaffListFilterState,
} from "@/lib/listFilters";
import { hrKeys } from "@/lib/queryClient";
import { formatDecimal } from "@/lib/decimal";
import FormModalFooter from "@/components/app/FormModalFooter";
import {
  allowancesToRows,
  defaultAllowanceRows,
  rowsToAllowances,
  type AllowanceRow,
} from "@/lib/hrAllowances";
import { EmployeeFormFields } from "@/components/hr/HrModalForms";

type Tab = "employees" | "attendance" | "leave" | "payroll";
const HR_TABS: readonly Tab[] = ["employees", "attendance", "leave", "payroll"];
type ModalKind = "employee" | "invite" | "payroll" | null;

const emptyEmpForm = {
  employee_code: "",
  name: "",
  position: "Cashier",
  basic_salary: "30000",
  allowances: defaultAllowanceRows(),
  status: "active",
};

type Employee = {
  id: string;
  employee_code: string;
  name: string;
  position?: string;
  basic_salary: string;
  allowances?: Record<string, string | number> | null;
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

function payrollStatusTone(
  status: string
): "info" | "success" | "warning" | "danger" {
  switch (status) {
    case "Approved":
    case "Posted":
    case "Disbursed":
      return "success";
    case "PendingApproval":
      return "warning";
    case "Rejected":
      return "danger";
    default:
      return "info";
  }
}

function displayAmount(value: string | number | null | undefined): string {
  if (value == null || value === "") return "—";
  return formatDecimal(value);
}

function payrollNetTotal(run: PayrollRun): number {
  return (run.payslips ?? []).reduce((sum, p) => sum + Number(p.net_pay || 0), 0);
}

function PayslipMeta({
  earnings,
  deductions,
}: {
  earnings?: Record<string, string>;
  deductions?: Record<string, string>;
}) {
  if (!earnings && !deductions) return null;

  const items: { label: string; value: string }[] = [];
  if (earnings) {
    items.push({
      label: "Credited",
      value: `${earnings.credited_hours ?? "—"}h / ${earnings.expected_hours ?? "—"}h`,
    });
    items.push({
      label: "Leave",
      value: `${earnings.leave_hours ?? "0"}h`,
    });
    items.push({
      label: "Base",
      value: displayAmount(earnings.base_pay),
    });
    items.push({
      label: "OT pay",
      value: formatDecimal(earnings.overtime_pay ?? "0"),
    });
  }
  if (deductions) {
    items.push({
      label: "Tax",
      value: formatDecimal(deductions.income_tax ?? "0"),
    });
    items.push({
      label: "EOBI",
      value: formatDecimal(deductions.eobi ?? "0"),
    });
  }

  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 border-s-2 border-border/70 ps-3 text-xs text-muted">
      {items.map((item) => (
        <span key={item.label} className="inline-flex items-baseline gap-1.5">
          <span className="font-medium text-muted">{item.label}</span>
          <span className="tabular-nums text-body">{item.value}</span>
        </span>
      ))}
    </div>
  );
}

export default function HrPage() {
  return (
    <Suspense fallback={<p className="text-sm text-body">Loading…</p>}>
      <HrPageInner />
    </Suspense>
  );
}

function HrPageInner() {
  const t = useT();
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const session = getSession();
  const businessId = session?.business_id ?? null;
  const canLeaveApprove = canAccessBundle(session, "leave_approve");
  const canPayrollApprove = canAccessBundle(session, "payroll_approve");
  const canSeePayroll = canPayrollApprove;
  const [tab, setTab] = useTabQueryParam<Tab>("employees", HR_TABS, {
    pathname: routes.hr,
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
  const [expandedPayrollId, setExpandedPayrollId] = useState<string | null>(null);
  const payrollAccordionReadyRef = useRef(false);

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

  useEffect(() => {
    if (payroll.length === 0) {
      setExpandedPayrollId(null);
      payrollAccordionReadyRef.current = false;
      return;
    }
    setExpandedPayrollId((current) => {
      if (current && payroll.some((run) => run.id === current)) {
        payrollAccordionReadyRef.current = true;
        return current;
      }
      if (current === null && payrollAccordionReadyRef.current) return null;
      payrollAccordionReadyRef.current = true;
      return payroll[0].id;
    });
  }, [payroll]);

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
      allowances: allowancesToRows(e.allowances),
      status: e.status || "active",
    });
    setModal("employee");
  }

  function updateAllowance(index: number, patch: Partial<AllowanceRow>) {
    setEmpForm((prev) => ({
      ...prev,
      allowances: prev.allowances.map((row, i) =>
        i === index ? { ...row, ...patch } : row
      ),
    }));
  }

  function addAllowance() {
    setEmpForm((prev) => ({
      ...prev,
      allowances: [...prev.allowances, { name: "", amount: "0" }],
    }));
  }

  function removeAllowance(index: number) {
    setEmpForm((prev) => ({
      ...prev,
      allowances:
        prev.allowances.length <= 1
          ? prev.allowances
          : prev.allowances.filter((_, i) => i !== index),
    }));
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
        allowances: rowsToAllowances(empForm.allowances),
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
      const res = await api<{ data: PayrollRun }>("/payroll", {
        method: "POST",
        body: JSON.stringify({
          period_start: periodStart,
          period_end: periodEnd,
        }),
      });
      toast.success(t("hr.payrollRun"));
      setModal(null);
      setExpandedPayrollId(res.data.id);
      payrollAccordionReadyRef.current = true;
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
            ? {
                label: t("hr.addEmployee"),
                onClick: openNewEmployee,
                icon: <UserPlus className="h-4 w-4" />,
              }
            : tab === "payroll"
              ? {
                  label: t("hr.runPayroll"),
                  onClick: () => setModal("payroll"),
                  icon: <Play className="h-4 w-4" />,
                }
              : undefined
        }
        secondaryAction={
          tab === "employees"
            ? {
                label: t("hr.inviteUser"),
                onClick: () => setModal("invite"),
                icon: <UserRoundPlus className="h-4 w-4" />,
              }
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
          onRowClick={(e) => navigate(detailRoutes.employee(e.id))}
          columns={[
            {
              id: "code",
              header: "Code",
              cell: (e) => (
                <span className="font-medium tabular-nums">{e.employee_code}</span>
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
              width: 48,
              cell: (e) => (
                <div className="flex justify-end">
                  <ActionMenu
                    items={[
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
          loading={attendanceLoading || attendanceFetching}
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
          getExportRow={(a) => ({
            date: a.date,
            employee: a.employee_name || "",
            in: a.clock_in || "",
            out: a.clock_out || "",
            source: a.source,
          })}
          exportColumns={[
            { key: "date", header: "Date" },
            { key: "employee", header: "Employee" },
            { key: "in", header: "In" },
            { key: "out", header: "Out" },
            { key: "source", header: "Source" },
          ]}
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
                    <Button
                      size="sm"
                      onClick={() => decideLeave(l.id, "approve")}
                      startIcon={<Check className="h-4 w-4" />}
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => decideLeave(l.id, "reject")}
                      startIcon={<X className="h-4 w-4" />}
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
        <div className="space-y-4">
          <p className="text-sm text-body">{t("hr.payrollComputeHint")}</p>
          {payroll.length === 0 ? (
            <SurfaceCard>
              <EmptyState
                title={t("hr.noPayrollRuns")}
                body={t("hr.noPayrollRunsBody")}
              />
            </SurfaceCard>
          ) : (
            <div
              className="space-y-2"
              role="region"
              aria-label={t("hr.payrollListLabel")}
            >
              {payroll.map((run) => {
                const expanded = run.id === expandedPayrollId;
                const slipCount = run.payslips?.length ?? 0;
                const panelId = `payroll-panel-${run.id}`;
                const headerId = `payroll-header-${run.id}`;
                return (
                  <SurfaceCard key={run.id} className="overflow-hidden p-0">
                    <button
                      type="button"
                      id={headerId}
                      aria-expanded={expanded}
                      aria-controls={expanded ? panelId : undefined}
                      onClick={() =>
                        setExpandedPayrollId(expanded ? null : run.id)
                      }
                      className={`flex w-full items-start gap-3 px-4 py-3 text-start transition ${
                        expanded
                          ? "bg-brand-light/60"
                          : "hover:bg-bg-tertiary"
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <span className="min-w-0 font-semibold text-heading">
                            {run.period_start} → {run.period_end}
                          </span>
                          <StatusBadge tone={payrollStatusTone(run.status)}>
                            {run.status === "PendingApproval"
                              ? t("hr.pendingApproval")
                              : run.status}
                          </StatusBadge>
                        </div>
                        <p className="mt-1 text-xs text-muted">
                          {t("hr.payslipSummary", {
                            count: slipCount,
                            net: displayAmount(payrollNetTotal(run)),
                          })}
                        </p>
                      </div>
                      <ChevronDown
                        className={`mt-0.5 h-4 w-4 shrink-0 text-muted transition-transform ${
                          expanded ? "rotate-180" : ""
                        }`}
                        aria-hidden
                      />
                    </button>
                    {expanded ? (
                      <div
                        id={panelId}
                        role="region"
                        aria-labelledby={headerId}
                        className="space-y-3 border-t border-border px-4 py-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="flex min-w-0 flex-wrap items-center gap-2">
                            {run.journal_entry_id ? (
                              <span className="text-xs text-muted">
                                {t("hr.postedToLedger")}
                              </span>
                            ) : null}
                            <Link
                              to={detailRoutes.payroll(run.id)}
                              className="text-xs font-medium text-brand underline"
                            >
                              {t("hr.openPayrollDetail")}
                            </Link>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {run.status === "Draft" ||
                            run.status === "Rejected" ? (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    payrollAction(run.id, "recalculate")
                                  }
                                  startIcon={<RefreshCw className="h-4 w-4" />}
                                >
                                  Recalculate
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    payrollAction(run.id, "submit")
                                  }
                                  startIcon={<Send className="h-4 w-4" />}
                                >
                                  Submit
                                </Button>
                              </>
                            ) : null}
                            {run.status === "PendingApproval" &&
                            canPayrollApprove ? (
                              <>
                                <Button
                                  size="sm"
                                  onClick={() =>
                                    payrollAction(run.id, "approve")
                                  }
                                  startIcon={<Check className="h-4 w-4" />}
                                >
                                  Approve & post
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    payrollAction(run.id, "reject")
                                  }
                                  startIcon={<X className="h-4 w-4" />}
                                >
                                  Reject
                                </Button>
                              </>
                            ) : null}
                          </div>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full min-w-[40rem] text-left text-sm">
                            <thead>
                              <tr className="border-b border-border text-[11px] font-bold uppercase tracking-[0.08em] text-muted">
                                <th className="py-2 pe-3 font-bold">Employee</th>
                                <th className="py-2 pe-3 text-end font-bold">Days</th>
                                <th className="py-2 pe-3 text-end font-bold">Hours</th>
                                <th className="py-2 pe-3 text-end font-bold">OT</th>
                                <th className="py-2 pe-3 text-end font-bold">Factor</th>
                                <th className="py-2 pe-3 text-end font-bold">Gross</th>
                                <th className="py-2 text-end font-bold">Net</th>
                              </tr>
                            </thead>
                            <tbody>
                              {run.payslips?.map((s) => {
                                const name =
                                  s.employee_name ||
                                  s.employee_code ||
                                  s.id.slice(0, 8);
                                const code =
                                  s.employee_name && s.employee_code
                                    ? s.employee_code
                                    : null;
                                const ot =
                                  s.overtime_hours ?? s.earnings?.ot_hours;
                                return (
                                  <Fragment key={s.id}>
                                    <tr className="border-t border-border text-heading">
                                      <td className="py-2.5 pe-3 align-top">
                                        <div className="font-medium leading-snug">
                                          {name}
                                        </div>
                                        {code ? (
                                          <div className="mt-0.5 text-xs text-muted">
                                            {code}
                                          </div>
                                        ) : null}
                                      </td>
                                      <td className="py-2.5 pe-3 text-end align-top tabular-nums">
                                        {s.days_worked ?? "—"}
                                      </td>
                                      <td className="py-2.5 pe-3 text-end align-top tabular-nums">
                                        {displayAmount(s.earnings?.worked_hours)}
                                      </td>
                                      <td className="py-2.5 pe-3 text-end align-top tabular-nums">
                                        {displayAmount(ot)}
                                      </td>
                                      <td className="py-2.5 pe-3 text-end align-top tabular-nums">
                                        {displayAmount(
                                          s.earnings?.attendance_factor
                                        )}
                                      </td>
                                      <td className="py-2.5 pe-3 text-end align-top tabular-nums">
                                        {displayAmount(s.gross_pay)}
                                      </td>
                                      <td className="py-2.5 text-end align-top font-medium tabular-nums">
                                        {displayAmount(s.net_pay)}
                                      </td>
                                    </tr>
                                    {s.earnings || s.deductions ? (
                                      <tr>
                                        <td colSpan={7} className="pb-3 pt-0">
                                          <PayslipMeta
                                            earnings={s.earnings}
                                            deductions={s.deductions}
                                          />
                                        </td>
                                      </tr>
                                    ) : null}
                                  </Fragment>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ) : null}
                  </SurfaceCard>
                );
              })}
            </div>
          )}
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
        footer={<FormModalFooter cancelLabel="Cancel" submitLabel={editingEmployeeId ? "Save changes" : "Save employee"} onCancel={closeEmployeeModal} submitFormId="employee-modal-form" loading={busy} />}
      >
        <form id="employee-modal-form" onSubmit={saveEmployee} className="space-y-4">
          <EmployeeFormFields
            form={empForm}
            editing={Boolean(editingEmployeeId)}
            onChange={setEmpForm}
            onAllowanceChange={updateAllowance}
            onAddAllowance={addAllowance}
            onRemoveAllowance={removeAllowance}
            t={t}
          />
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
              triggerClassName="border-border bg-bg-secondary/80"
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
