import { useCallback, useEffect, useState } from "react";
import { router } from "expo-router";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { api, colors, getSession, type Session } from "../lib/api";

type Tab = "clock" | "leave" | "payslips";

type EssData = {
  employee: { id: string; name: string; employee_code: string; position?: string };
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
    deductions?: Record<string, string>;
  }[];
};

export default function EssScreen() {
  const [session, setLocal] = useState<Session | null>(null);
  const [tab, setTab] = useState<Tab>("clock");
  const [data, setData] = useState<EssData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [leaveType, setLeaveType] = useState("annual");
  const [leaveStart, setLeaveStart] = useState(new Date().toISOString().slice(0, 10));
  const [leaveEnd, setLeaveEnd] = useState(new Date().toISOString().slice(0, 10));
  const [leaveReason, setLeaveReason] = useState("");

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
        router.replace("/landing");
        return;
      }
      setLocal(s);
      await load();
    })();
  }, [load]);

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

  async function requestLeave() {
    setBusy(true);
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
      setMessage("Leave requested");
      setLeaveReason("");
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
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <Text style={styles.title}>Staff tools</Text>
      <Text style={styles.hint}>
        {data?.employee
          ? `${data.employee.name} · ${data.employee.employee_code}`
          : "Link your login to an employee profile to use ESS."}
      </Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {message ? <Text style={styles.message}>{message}</Text> : null}

      <View style={styles.tabs}>
        {(
          [
            ["clock", "Clock"],
            ["leave", "Leave"],
            ["payslips", "Payslips"],
          ] as const
        ).map(([id, label]) => (
          <Pressable
            key={id}
            style={[styles.tab, tab === id && styles.tabActive]}
            onPress={() => setTab(id)}
          >
            <Text style={[styles.tabText, tab === id && styles.tabTextActive]}>{label}</Text>
          </Pressable>
        ))}
      </View>

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
          <TextInput
            style={styles.input}
            value={leaveType}
            onChangeText={setLeaveType}
            placeholder="Type (annual / sick)"
            placeholderTextColor={colors.muted}
          />
          <TextInput
            style={styles.input}
            value={leaveStart}
            onChangeText={setLeaveStart}
            placeholder="Start YYYY-MM-DD"
            placeholderTextColor={colors.muted}
          />
          <TextInput
            style={styles.input}
            value={leaveEnd}
            onChangeText={setLeaveEnd}
            placeholder="End YYYY-MM-DD"
            placeholderTextColor={colors.muted}
          />
          <TextInput
            style={styles.input}
            value={leaveReason}
            onChangeText={setLeaveReason}
            placeholder="Reason"
            placeholderTextColor={colors.muted}
          />
          <Pressable style={styles.btn} onPress={requestLeave} disabled={busy || !data}>
            <Text style={styles.btnText}>Submit request</Text>
          </Pressable>

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
                  Gross {p.gross_pay} · Net {p.net_pay}
                </Text>
                {p.deductions ? (
                  <Text style={styles.row}>
                    Tax {p.deductions.income_tax || "0"} · EOBI {p.deductions.eobi || "0"}
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

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: colors.bgPrimary },
  title: { fontSize: 24, fontWeight: "800", color: colors.heading, marginBottom: 4 },
  hint: { color: colors.body, marginBottom: 16 },
  error: { color: colors.danger, marginBottom: 8 },
  message: { color: colors.body, marginBottom: 8 },
  tabs: { flexDirection: "row", gap: 8, marginBottom: 16 },
  tab: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.card,
  },
  tabActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  tabText: { color: colors.heading, fontWeight: "600" },
  tabTextActive: { color: colors.white },
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTitle: { fontSize: 16, fontWeight: "700", color: colors.heading },
  cardBody: { marginTop: 4, color: colors.body, marginBottom: 12 },
  btn: {
    backgroundColor: colors.brand,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 8,
  },
  btnText: { color: colors.white, fontWeight: "700" },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 8,
    color: colors.heading,
    backgroundColor: colors.bgSecondary,
  },
  row: { color: colors.body, marginTop: 6, fontSize: 13 },
  slip: { marginBottom: 14, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
});
