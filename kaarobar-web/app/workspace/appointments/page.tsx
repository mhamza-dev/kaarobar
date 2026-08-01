"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api, getSession } from "@/lib/api/client";
import Button from "@/components/ui/Button";
import DataTable from "@/components/ui/DataTable";
import ListToolbar from "@/components/app/ListToolbar";
import {
  Alert,
  EmptyState,
  Field,
  PageHeader,
  StatusBadge,
  fieldClass,
} from "@/components/app/ui";
import { useToast } from "@/components/ui/Toast";
import { useT } from "@/lib/i18n";
import {
  emptyStaffListFilters,
  type ListFilterConfig,
  type StaffListFilterState,
} from "@/lib/listFilters";

type AppointmentRow = {
  id: string;
  customer_name?: string | null;
  product_name?: string | null;
  staff_name?: string | null;
  staff_id?: string;
  starts_at?: string | null;
  ends_at?: string | null;
  status: string;
  notes?: string | null;
};

type Employee = { id: string; name: string };

type BusinessMeta = {
  id: string;
  appointments_enabled?: boolean;
  industry?: string | null;
};

const APPT_STATUSES = [
  "Booked",
  "CheckedIn",
  "InProgress",
  "Completed",
  "Cancelled",
  "NoShow",
];

function statusTone(status: string): "success" | "warning" | "danger" | "info" {
  const s = status.toLowerCase();
  if (s === "completed") return "success";
  if (s === "cancelled" || s === "noshow") return "danger";
  if (s === "booked" || s === "checkedin" || s === "inprogress") return "warning";
  return "info";
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Staff appointment schedule/list (SCH-FR-003) — service businesses. */
export default function AppointmentsPage() {
  const t = useT();
  const toast = useToast();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [date, setDate] = useState(todayIso());
  const [rows, setRows] = useState<AppointmentRow[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [staffId, setStaffId] = useState("");
  const [filters, setFilters] = useState<StaffListFilterState>(emptyStaffListFilters());
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filterConfig = useMemo<ListFilterConfig>(
    () => ({
      showDateRange: false,
      statusOptions: APPT_STATUSES.map((s) => ({ value: s, label: s })),
    }),
    []
  );

  useEffect(() => {
    const session = getSession();
    if (!session?.business_id) {
      setEnabled(false);
      setLoading(false);
      return;
    }
    void api<{ data: BusinessMeta }>(`/businesses/${session.business_id}`)
      .then((res) => {
        const on =
          !!res.data.appointments_enabled || res.data.industry === "salon";
        setEnabled(on);
      })
      .catch(() => setEnabled(false));
  }, []);

  useEffect(() => {
    if (!enabled) return;
    void api<{ data: Employee[] }>("/employees")
      .then((res) => setEmployees((res.data || []).map((e) => ({ id: e.id, name: e.name }))))
      .catch(() => setEmployees([]));
  }, [enabled]);

  const load = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("from", `${date}T00:00:00Z`);
      params.set("to", `${date}T23:59:59Z`);
      if (staffId) params.set("staff_id", staffId);
      if (filters.statuses.length === 1) params.set("status", filters.statuses[0]);
      const res = await api<{ data: AppointmentRow[] }>(
        `/appointments?${params.toString()}`
      );
      let data = res.data || [];
      const q = filters.search.trim().toLowerCase();
      if (q) {
        data = data.filter((r) =>
          [r.customer_name, r.product_name, r.staff_name, r.status]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(q)
        );
      }
      if (filters.statuses.length > 1) {
        data = data.filter((r) => filters.statuses.includes(r.status));
      }
      setRows(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("appointments.loadFailed"));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [date, enabled, filters.search, filters.statuses, staffId, t]);

  useEffect(() => {
    if (enabled) void load();
    else if (enabled === false) setLoading(false);
  }, [enabled, load]);

  async function cancel(id: string) {
    setBusyId(id);
    try {
      await api(`/appointments/${id}/cancel`, { method: "POST", body: "{}" });
      toast.success(t("appointments.cancelled"));
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("appointments.cancelFailed"));
    } finally {
      setBusyId(null);
    }
  }

  async function complete(id: string) {
    setBusyId(id);
    try {
      await api(`/appointments/${id}/complete`, { method: "POST", body: "{}" });
      toast.success(t("appointments.completed"));
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("appointments.completeFailed"));
    } finally {
      setBusyId(null);
    }
  }

  if (enabled === false) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow={t("nav.cashier")}
          title={t("pages.appointmentsTitle")}
          description={t("pages.appointmentsDesc")}
          infoKey="page.appointments"
        />
        <EmptyState
          title={t("appointments.disabledTitle")}
          body={t("appointments.disabledBody")}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t("nav.cashier")}
        title={t("pages.appointmentsTitle")}
        description={t("pages.appointmentsDesc")}
        infoKey="page.appointments"
      />

      <div className="flex flex-wrap items-end gap-3">
        <Field label={t("appointments.date")}>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={fieldClass}
          />
        </Field>
        <Field label={t("appointments.staffFilter")}>
          <select
            value={staffId}
            onChange={(e) => setStaffId(e.target.value)}
            className={fieldClass}
          >
            <option value="">{t("appointments.allStaff")}</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <ListToolbar
        value={filters}
        onChange={setFilters}
        config={filterConfig}
        searchPlaceholder={t("appointments.searchPlaceholder")}
      />

      {error ? <Alert tone="error">{error}</Alert> : null}

      <DataTable
        data={rows}
        loading={loading || enabled === null}
        emptyTitle={t("appointments.emptyScheduleTitle")}
        emptyBody={t("appointments.emptyScheduleBody")}
        rowKey={(r) => r.id}
        columns={[
          {
            id: "time",
            header: t("appointments.time"),
            cell: (r) =>
              r.starts_at
                ? new Date(r.starts_at).toLocaleTimeString(undefined, {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "—",
          },
          {
            id: "customer",
            header: t("appointments.customer"),
            cell: (r) => r.customer_name || "—",
          },
          {
            id: "service",
            header: t("appointments.service"),
            cell: (r) => r.product_name || "—",
          },
          {
            id: "staff",
            header: t("appointments.staff"),
            cell: (r) => r.staff_name || "—",
          },
          {
            id: "status",
            header: t("common.status"),
            cell: (r) => (
              <StatusBadge tone={statusTone(r.status)}>{r.status}</StatusBadge>
            ),
          },
          {
            id: "actions",
            header: "",
            cell: (r) => (
              <div className="flex flex-wrap justify-end gap-2">
                {r.status === "Booked" ||
                r.status === "CheckedIn" ||
                r.status === "InProgress" ? (
                  <Button
                    size="sm"
                    variant="outline"
                    loading={busyId === r.id}
                    onClick={() => void complete(r.id)}
                    className="rounded-md"
                  >
                    {t("appointments.complete")}
                  </Button>
                ) : null}
                {r.status === "Booked" ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    loading={busyId === r.id}
                    onClick={() => void cancel(r.id)}
                    className="rounded-md"
                  >
                    {t("appointments.cancel")}
                  </Button>
                ) : null}
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}
