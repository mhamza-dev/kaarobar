import {useCallback, useEffect, useState, useMemo } from "react";
import { type Theme, useTheme } from "@/theme";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { api, getSession } from "@/lib/api";
import { canAccess } from "@/lib/rbac";
import { loadLocale, t } from "@/lib/i18n";
import { useToast } from "@/components/toast";
import { goBack, pushPath, replacePath } from "@/lib/nav";

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
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const toast = useToast();
  const [items, setItems] = useState<Leave[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const s = await getSession();
    if (!s) {
      replacePath("/landing");
      return;
    }
    if (!canAccess(s, "leave_approve")) {
      toast.error("forbidden_role");
      goBack();
      return;
    }
    try {
      const res = await api<{ data: Leave[] }>("/app/leave");
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
        <ActivityIndicator color={theme.brand} />
      </View>
    );
  }

  return (
    <>
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

function createStyles(t: Theme) {
  return StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: t.bgPrimary },
  container: { flex: 1, backgroundColor: t.bgPrimary, padding: 16 },
  empty: { textAlign: "center", color: t.muted, marginTop: 24 },
  card: {
    backgroundColor: t.card,
    borderWidth: 1,
    borderColor: t.border,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  title: { fontWeight: "700", color: t.heading, fontSize: 16 },
  body: { marginTop: 4, color: t.body },
  meta: { marginTop: 6, color: t.muted, fontSize: 12 },
  row: { flexDirection: "row", gap: 8, marginTop: 12 },
  btn: {
    backgroundColor: t.brand,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  btnText: { color: t.white, fontWeight: "700" },
  btnSecondary: {
    borderWidth: 1,
    borderColor: t.border,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  btnSecondaryText: { color: t.heading, fontWeight: "700" },
});
}
