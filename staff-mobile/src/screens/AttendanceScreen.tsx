import { useCallback, useEffect, useState, useMemo } from "react";
import { type Theme, useTheme } from "@/theme";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { pickImageFromLibrary } from "@/lib/imagePicker";
import { api, getSession, type Session } from "@/lib/api";
import { canAccessRoute } from "@/lib/rbac";
import { formatDecimal } from "@/lib/decimal";
import SegmentedTabs from "@/components/segmented-tabs";
import { replacePath } from "@/lib/nav";
import { useTabParam } from "@/hooks/useTabParam";
import CustomForm from "@/components/form/custom-form";
import { FormikTextField, FormikDateTimeField } from "@/components/form/form-fields";
import {
  emptyLeaveRequestForm,
  leaveRequestFormSchema,
  type LeaveRequestFormValues,
} from "@/lib/validations/hr";

type Tab = "clock" | "leave" | "payslips";
const ATTENDANCE_TABS: readonly Tab[] = ["clock", "leave", "payslips"];

type EssData = {
  employee: {
    id: string;
    name: string;
    employee_code: string;
    position?: string;
    profile_pic_url?: string | null;
  };
  open_attendance?: { id: string; date: string; clock_in: string } | null;
  attendance: { id: string; date: string; clock_in?: string; clock_out?: string }[];
  leave: {
    id: string;
    type: string;
    start_date: string;
    end_date: string;
    status: string;
    reason?: string;
  }[];
  payslips: {
    id: string;
    gross_pay: string;
    net_pay: string;
    period_start?: string;
    period_end?: string;
    overtime_hours?: string;
    earnings?: Record<string, string>;
    deductions?: Record<string, string>;
  }[];
};

export default function EssScreen() {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [session, setLocal] = useState<Session | null>(null);
  const [tab, setTab] = useTabParam<Tab>("clock", ATTENDANCE_TABS);
  const [data, setData] = useState<EssData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [leaveInitial, setLeaveInitial] = useState(emptyLeaveRequestForm());

  const load = useCallback(async () => {
    try {
      const res = await api<{ data: EssData }>("/ess/me");
      setData(res.data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load ESS");
      setData(null);
    }
  }, []);

  useEffect(() => {
    (async () => {
      const s = await getSession();
      if (!s) {
        replacePath("/landing");
        return;
      }
      if (!canAccessRoute(s, "/app/ess")) {
        replacePath("/app/dashboard");
        return;
      }
      setLocal(s);
      await load();
    })();
  }, [load]);

  async function pickEmployeePhoto() {
    const asset = await pickImageFromLibrary();
    if (!asset) return;
    setBusy(true);
    setMessage(null);
    try {
      const fd = new FormData();
      fd.append("file", {
        uri: asset.uri,
        name: asset.fileName || "employee.jpg",
        type: asset.type || "image/jpeg",
      } as unknown as Blob);
      const body = await api<{ data: EssData["employee"] }>("/ess/me/profile-pic", {
        method: "POST",
        body: fd,
      });
      setData((d) => (d ? { ...d, employee: { ...d.employee, ...body.data } } : d));
      setMessage("Photo updated");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function clockIn() {
    if (!session?.branch_id) {
      setError("Select a branch on the dashboard first.");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      await api("/attendance/clock-in", {
        method: "POST",
        body: JSON.stringify({ source: "mobile", branch_id: session.branch_id }),
      });
      setMessage("Clocked in");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Clock-in failed");
    } finally {
      setBusy(false);
    }
  }

  async function clockOut() {
    if (!data?.open_attendance?.id) return;
    setBusy(true);
    try {
      await api(`/attendance/${data.open_attendance.id}/clock-out`, {
        method: "POST",
        body: "{}",
      });
      setMessage("Clocked out");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Clock-out failed");
    } finally {
      setBusy(false);
    }
  }

  async function requestLeave(values: LeaveRequestFormValues) {
    setBusy(true);
    try {
      await api("/app/leave", {
        method: "POST",
        body: JSON.stringify({
          type: values.type,
          start_date: values.start_date,
          end_date: values.end_date,
          reason: values.reason,
        }),
      });
      setMessage("Leave requested");
      setLeaveInitial(emptyLeaveRequestForm());
      setTab("leave");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Leave failed");
    } finally {
      setBusy(false);
    }
  }

  if (!session) {
    return (
      <View style={styles.container}>
        <ActivityIndicator color={theme.brand} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <Text style={styles.title}>Staff tools</Text>

      {data?.employee ? (
        <View
          style={[
            styles.card,
            { marginBottom: 12, flexDirection: "row", alignItems: "center", gap: 12 },
          ]}
        >
          {data.employee.profile_pic_url ? (
            <Image
              source={{ uri: data.employee.profile_pic_url }}
              style={{ width: 56, height: 56, borderRadius: 12 }}
            />
          ) : (
            <View
              style={{
                width: 56,
                height: 56,
                borderRadius: 12,
                backgroundColor: theme.brand,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ color: theme.white, fontWeight: "800" }}>
                {(data.employee.name || "?").slice(0, 1)}
              </Text>
            </View>
          )}
          <Pressable
            style={[styles.btn, { flex: 1, marginTop: 0 }]}
            onPress={pickEmployeePhoto}
            disabled={busy}
          >
            <Text style={styles.btnText}>
              {data.employee.profile_pic_url ? "Change photo" : "Upload photo"}
            </Text>
          </Pressable>
        </View>
      ) : null}

      <Text style={styles.hint}>
        {data?.employee
          ? `${data.employee.name} · ${data.employee.employee_code}`
          : "Link your login to an employee profile to use ESS."}
      </Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {message ? <Text style={styles.message}>{message}</Text> : null}

      <SegmentedTabs
        tabs={[
          { id: "clock", label: "Clock" },
          { id: "leave", label: "Leave" },
          { id: "payslips", label: "Payslips" },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === "clock" ? (
        <View style={styles.card}>
          {data?.open_attendance ? (
            <>
              <Text style={styles.cardTitle}>On shift since</Text>
              <Text style={styles.cardBody}>
                {new Date(data.open_attendance.clock_in).toLocaleString()}
              </Text>
              <Pressable style={styles.btn} onPress={clockOut} disabled={busy}>
                <Text style={styles.btnText}>{busy ? "…" : "Clock out"}</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={styles.cardTitle}>Not clocked in</Text>
              <Text style={styles.cardBody}>Mark attendance for today from your phone.</Text>
              <Pressable style={styles.btn} onPress={clockIn} disabled={busy || !data}>
                <Text style={styles.btnText}>{busy ? "…" : "Clock in"}</Text>
              </Pressable>
            </>
          )}

          <Text style={[styles.cardTitle, { marginTop: 16 }]}>Recent</Text>
          {(data?.attendance || []).slice(0, 8).map((a) => (
            <Text key={a.id} style={styles.row}>
              {a.date}: {a.clock_in ? new Date(a.clock_in).toLocaleTimeString() : "—"} →{" "}
              {a.clock_out ? new Date(a.clock_out).toLocaleTimeString() : "open"}
            </Text>
          ))}
        </View>
      ) : null}

      {tab === "leave" ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Request leave</Text>
          <CustomForm
            initialValues={leaveInitial}
            validationSchema={leaveRequestFormSchema}
            enableReinitialize
            onSubmit={requestLeave}
          >
            {({ handleSubmit }) => (
              <>
                <FormikTextField
                  name="type"
                  style={styles.input}
                  placeholder="Type (annual / sick)"
                />
                <FormikDateTimeField
                  name="start_date"
                  label="Start date"
                  mode="date"
                  placeholder="YYYY-MM-DD"
                />
                <FormikDateTimeField
                  name="end_date"
                  label="End date"
                  mode="date"
                  placeholder="YYYY-MM-DD"
                />
                <FormikTextField name="reason" style={styles.input} placeholder="Reason" />
                <Pressable
                  style={styles.btn}
                  onPress={() => handleSubmit()}
                  disabled={busy || !data}
                >
                  <Text style={styles.btnText}>Submit request</Text>
                </Pressable>
              </>
            )}
          </CustomForm>

          <Text style={[styles.cardTitle, { marginTop: 16 }]}>My requests</Text>
          {(data?.leave || []).map((l) => (
            <Text key={l.id} style={styles.row}>
              {l.type} · {l.start_date}→{l.end_date} · {l.status}
            </Text>
          ))}
        </View>
      ) : null}

      {tab === "payslips" ? (
        <View style={styles.card}>
          {(data?.payslips || []).length === 0 ? (
            <Text style={styles.cardBody}>No payslips yet.</Text>
          ) : (
            data?.payslips.map((p) => (
              <View key={p.id} style={styles.slip}>
                <Text style={styles.cardTitle}>
                  {p.period_start} → {p.period_end}
                </Text>
                <Text style={styles.cardBody}>
                  Gross {formatDecimal(p.gross_pay)} · Net {formatDecimal(p.net_pay)}
                </Text>
                <Text style={styles.row}>
                  Hours {p.earnings?.worked_hours || "0"} · OT{" "}
                  {p.overtime_hours || p.earnings?.ot_hours || "0"} · Factor{" "}
                  {p.earnings?.attendance_factor != null &&
                  p.earnings.attendance_factor !== ""
                    ? formatDecimal(p.earnings.attendance_factor)
                    : "—"}
                </Text>
                {p.deductions ? (
                  <Text style={styles.row}>
                    Tax {formatDecimal(p.deductions.income_tax || "0")} · EOBI{" "}
                    {formatDecimal(p.deductions.eobi || "0")}
                  </Text>
                ) : null}
              </View>
            ))
          )}
        </View>
      ) : null}
    </ScrollView>
  );
}

function createStyles(t: Theme) {
  return StyleSheet.create({
    container: { flex: 1, padding: 24, backgroundColor: t.bgPrimary },
    title: { fontSize: 24, fontWeight: "800", color: t.heading, marginBottom: 4 },
    hint: { color: t.body, marginBottom: 16 },
    error: { color: t.danger, marginBottom: 8 },
    message: { color: t.body, marginBottom: 8 },
    card: {
      backgroundColor: t.card,
      borderRadius: 12,
      padding: 16,
      borderWidth: 1,
      borderColor: t.border,
    },
    cardTitle: { fontSize: 16, fontWeight: "700", color: t.heading },
    cardBody: { marginTop: 4, color: t.body, marginBottom: 12 },
    btn: {
      backgroundColor: t.brand,
      borderRadius: 10,
      paddingVertical: 12,
      alignItems: "center",
      marginTop: 8,
    },
    btnText: { color: t.white, fontWeight: "700" },
    input: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      marginTop: 8,
      color: t.heading,
      backgroundColor: t.bgSecondary,
    },
    row: { color: t.body, marginTop: 6, fontSize: 13 },
    slip: {
      marginBottom: 14,
      paddingBottom: 10,
      borderBottomWidth: 1,
      borderBottomColor: t.border,
    },
  });
}
