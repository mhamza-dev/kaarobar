import { useCallback, useEffect, useState } from "react";
import { api, getSession } from "@/lib/api/client";
import Button from "@/components/ui/Button";
import { PageHeader, SurfaceCard, TabBar, fieldClass } from "@/components/app/ui";
import { useToast } from "@/components/ui/Toast";
import { useT } from "@/lib/i18n";

type EssData = {
  employee?: { id: string; name?: string; employee_code?: string } | null;
  open_attendance?: { id: string; clock_in?: string } | null;
  attendance?: {
    id: string;
    date: string;
    clock_in?: string | null;
    clock_out?: string | null;
  }[];
  leave?: {
    id: string;
    type: string;
    start_date: string;
    end_date: string;
    reason?: string | null;
    status: string;
  }[];
  payslips?: {
    id: string;
    period_start?: string;
    period_end?: string;
    gross_pay?: string;
    net_pay?: string;
    status?: string;
    overtime_hours?: string;
    earnings?: Record<string, string>;
    deductions?: Record<string, string>;
  }[];
};

function formatDateTime(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

export default function EssPage() {
  const t = useT();
  const toast = useToast();
  const [tab, setTab] = useState<"clock" | "leave" | "payslips">("clock");
  const [data, setData] = useState<EssData | null>(null);
  const [loading, setLoading] = useState(true);
  const [leaveType, setLeaveType] = useState("annual");
  const [leaveStart, setLeaveStart] = useState(() => new Date().toISOString().slice(0, 10));
  const [leaveEnd, setLeaveEnd] = useState(() => new Date().toISOString().slice(0, 10));
  const [leaveReason, setLeaveReason] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api<{ data: EssData }>("/ess/me");
      setData(res.data || {});
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load staff tools");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  async function clockIn() {
    const session = getSession();
    if (!session?.branch_id) {
      toast.warning("Select a branch first.");
      return;
    }
    try {
      await api("/attendance/clock-in", {
        method: "POST",
        body: JSON.stringify({ source: "desktop", branch_id: session.branch_id }),
      });
      toast.success("Clocked in");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Clock-in failed");
    }
  }

  async function clockOut() {
    if (!data?.open_attendance?.id) return;
    try {
      await api(`/attendance/${data.open_attendance.id}/clock-out`, {
        method: "POST",
        body: "{}",
      });
      toast.success("Clocked out");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Clock-out failed");
    }
  }

  async function submitLeave(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api("/leave", {
        method: "POST",
        body: JSON.stringify({
          type: leaveType,
          start_date: leaveStart,
          end_date: leaveEnd,
          reason: leaveReason,
        }),
      });
      toast.success("Leave requested");
      setLeaveReason("");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Leave request failed");
    }
  }

  const emp = data?.employee;
  const hint = emp
    ? `${emp.name || "Employee"} · ${emp.employee_code || ""}`
    : "Link your login to an employee profile to use ESS.";

  return (
    <div className="space-y-6">
      <PageHeader title={t("nav.ess")} description={hint} />
      <TabBar
        tabs={[
          { id: "clock", label: "Clock" },
          { id: "leave", label: "Leave" },
          { id: "payslips", label: "Payslips" },
        ]}
        value={tab}
        onChange={setTab}
      />

      {loading ? (
        <p className="text-sm text-body">{t("common.loading")}</p>
      ) : null}

      {!loading && tab === "clock" ? (
        <div className="space-y-4">
          <SurfaceCard className="p-5">
            {data?.open_attendance?.clock_in ? (
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-bold text-heading">On shift since</h3>
                  <p className="mt-1 text-sm text-body">
                    {formatDateTime(data.open_attendance.clock_in)}
                  </p>
                </div>
                <Button onClick={() => void clockOut()}>Clock out</Button>
              </div>
            ) : (
              <div>
                <h3 className="text-lg font-bold text-heading">Not clocked in</h3>
                <p className="mt-1 text-sm text-body">
                  Mark attendance for today from your desktop.
                </p>
                <Button className="mt-4" onClick={() => void clockIn()}>
                  Clock in
                </Button>
              </div>
            )}
          </SurfaceCard>
          <SurfaceCard className="p-5">
            <h3 className="mb-3 text-base font-bold text-heading">Recent attendance</h3>
            <div className="divide-y divide-border">
              {(data?.attendance || []).slice(0, 8).map((a) => (
                <div key={a.id} className="flex justify-between gap-3 py-3 text-sm">
                  <span className="font-medium text-heading">{a.date}</span>
                  <span className="text-body">
                    {a.clock_in ? formatDateTime(a.clock_in) : "—"} →{" "}
                    {a.clock_out ? formatDateTime(a.clock_out) : "open"}
                  </span>
                </div>
              ))}
              {(data?.attendance || []).length === 0 ? (
                <p className="py-2 text-sm text-body">No attendance yet</p>
              ) : null}
            </div>
          </SurfaceCard>
        </div>
      ) : null}

      {!loading && tab === "leave" ? (
        <div className="space-y-4">
          <SurfaceCard className="p-5">
            <h3 className="mb-4 text-base font-bold text-heading">Request leave</h3>
            <form className="grid max-w-xl gap-3" onSubmit={(e) => void submitLeave(e)}>
              <label className="block text-sm">
                <span className="mb-1.5 block font-medium text-heading">Type</span>
                <select
                  className={fieldClass}
                  value={leaveType}
                  onChange={(e) => setLeaveType(e.target.value)}
                >
                  <option value="annual">annual</option>
                  <option value="sick">sick</option>
                  <option value="other">other</option>
                </select>
              </label>
              <label className="block text-sm">
                <span className="mb-1.5 block font-medium text-heading">Start date</span>
                <input
                  type="date"
                  className={fieldClass}
                  value={leaveStart}
                  onChange={(e) => setLeaveStart(e.target.value)}
                  required
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1.5 block font-medium text-heading">End date</span>
                <input
                  type="date"
                  className={fieldClass}
                  value={leaveEnd}
                  onChange={(e) => setLeaveEnd(e.target.value)}
                  required
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1.5 block font-medium text-heading">Reason</span>
                <input
                  type="text"
                  className={fieldClass}
                  value={leaveReason}
                  onChange={(e) => setLeaveReason(e.target.value)}
                  placeholder="Reason"
                />
              </label>
              <div>
                <Button type="submit">Submit request</Button>
              </div>
            </form>
          </SurfaceCard>
          <SurfaceCard className="p-5">
            <h3 className="mb-3 text-base font-bold text-heading">My requests</h3>
            <div className="divide-y divide-border">
              {(data?.leave || []).map((l) => (
                <div key={l.id} className="flex justify-between gap-3 py-3 text-sm">
                  <div>
                    <p className="font-semibold text-heading">{l.type}</p>
                    <p className="text-body">
                      {l.start_date} → {l.end_date}
                    </p>
                    {l.reason ? <p className="text-body">Reason: {l.reason}</p> : null}
                  </div>
                  <span className="text-body">{l.status}</span>
                </div>
              ))}
              {(data?.leave || []).length === 0 ? (
                <p className="py-2 text-sm text-body">No leave requests</p>
              ) : null}
            </div>
          </SurfaceCard>
        </div>
      ) : null}

      {!loading && tab === "payslips" ? (
        <SurfaceCard className="p-5">
          <h3 className="mb-3 text-base font-bold text-heading">Payslips</h3>
          <div className="divide-y divide-border">
            {(data?.payslips || []).map((p) => (
              <div key={p.id} className="flex justify-between gap-3 py-3 text-sm">
                <div>
                  <p className="font-semibold text-heading">
                    {p.period_start || "—"} → {p.period_end || "—"}
                  </p>
                  <p className="text-body">
                    Gross {p.gross_pay} · Net {p.net_pay}
                  </p>
                  <p className="text-body">
                    Hours {p.earnings?.worked_hours || "0"} · OT{" "}
                    {p.overtime_hours || p.earnings?.ot_hours || "0"} · Factor{" "}
                    {p.earnings?.attendance_factor || "—"}
                  </p>
                  {p.deductions ? (
                    <p className="text-body">
                      Tax {p.deductions.income_tax || "0"} · EOBI {p.deductions.eobi || "0"}
                    </p>
                  ) : null}
                </div>
                <span className="text-body">{p.status || ""}</span>
              </div>
            ))}
            {(data?.payslips || []).length === 0 ? (
              <p className="py-2 text-sm text-body">No payslips yet.</p>
            ) : null}
          </div>
        </SurfaceCard>
      ) : null}
    </div>
  );
}
