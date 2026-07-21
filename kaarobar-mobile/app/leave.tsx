import { useCallback, useEffect, useState } from "react";
import { router, Stack } from "expo-router";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { api, colors, getSession } from "../lib/api";
import { canAccess } from "../lib/rbac";
import { loadLocale, t } from "../lib/i18n";
import { useToast } from "../components/Toast";

type Leave = {
  id: string;
  employee_name?: string;
  type: string;
  start_date: string;
  end_date: string;
  status: string;
  reason?: string;
};

export default function LeaveApproveScreen() {
  const toast = useToast();
  const [items, setItems] = useState<Leave[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const s = await getSession();
    if (!s) {
      router.replace("/landing");
      return;
    }
    if (!canAccess(s, "leave_approve")) {
      toast.error("forbidden_role");
      router.back();
      return;
    }
    try {
      const res = await api<{ data: Leave[] }>("/leave");
      setItems(res.data || []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void (async () => {
      await loadLocale();
      await load();
    })();
  }, [load]);

  async function decide(id: string, action: "approve" | "reject") {
    setBusy(true);
    try {
      await api(`/leave/${id}/${action}`, { method: "POST", body: "{}" });
      toast.success(action === "approve" ? "Leave approved" : "Leave rejected");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: "Leave approvals" }} />
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
        {items.length === 0 ? (
          <Text style={styles.empty}>No leave requests</Text>
        ) : (
          items.map((l) => (
            <View key={l.id} style={styles.card}>
              <Text style={styles.title}>
                {l.employee_name || "Employee"} · {l.type}
              </Text>
              <Text style={styles.body}>
                {l.start_date} → {l.end_date}
              </Text>
              <Text style={styles.meta}>
                {l.status}
                {l.reason ? ` · ${l.reason}` : ""}
              </Text>
              {l.status === "Pending" ? (
                <View style={styles.row}>
                  <Pressable
                    style={styles.btn}
                    disabled={busy}
                    onPress={() => void decide(l.id, "approve")}
                  >
                    <Text style={styles.btnText}>Approve</Text>
                  </Pressable>
                  <Pressable
                    style={styles.btnSecondary}
                    disabled={busy}
                    onPress={() => void decide(l.id, "reject")}
                  >
                    <Text style={styles.btnSecondaryText}>Reject</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          ))
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bgPrimary },
  container: { flex: 1, backgroundColor: colors.bgPrimary, padding: 16 },
  empty: { textAlign: "center", color: colors.muted, marginTop: 24 },
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  title: { fontWeight: "700", color: colors.heading, fontSize: 16 },
  body: { marginTop: 4, color: colors.body },
  meta: { marginTop: 6, color: colors.muted, fontSize: 12 },
  row: { flexDirection: "row", gap: 8, marginTop: 12 },
  btn: {
    backgroundColor: colors.brand,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  btnText: { color: colors.white, fontWeight: "700" },
  btnSecondary: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  btnSecondaryText: { color: colors.heading, fontWeight: "700" },
});
