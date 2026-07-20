import { useEffect, useState } from "react";
import { Link, router } from "expo-router";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { api, clearSession, colors, getSession, setSession, type Session } from "../lib/api";

type Dashboard = {
  sales_today: string;
  cash_position: string;
  low_stock_count: number;
  pending_approvals: number;
};

export default function DashboardScreen() {
  const [session, setLocal] = useState<Session | null>(null);
  const [dash, setDash] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const s = await getSession();
      if (!s) {
        router.replace("/landing");
        return;
      }
      setLocal(s);
      try {
        const biz = await api<{ data: { id: string }[] }>("/businesses", {}, s);
        let next = s;
        if (biz.data?.[0] && !s.business_id) {
          next = { ...s, business_id: biz.data[0].id };
          await setSession(next);
          const br = await api<{ data: { id: string }[] }>(
            `/businesses/${biz.data[0].id}/branches`,
            {},
            next
          );
          if (br.data?.[0]) {
            next = { ...next, branch_id: br.data[0].id };
            await setSession(next);
          }
        }
        const res = await api<{ data: Dashboard }>("/reports/dashboard", {}, next);
        setDash(res.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      }
    })();
  }, []);

  if (!session) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.hello}>Welcome, {session.user.name}</Text>
      <Text style={styles.hint}>Sales, cash, stock, and approvals across your shops.</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.grid}>
        {[
          { label: "Sales today", value: dash?.sales_today ?? "—" },
          { label: "Cash position", value: dash?.cash_position ?? "—" },
          { label: "Low stock", value: String(dash?.low_stock_count ?? "—") },
          { label: "Approvals", value: String(dash?.pending_approvals ?? "—") },
        ].map((card) => (
          <View key={card.label} style={styles.card}>
            <Text style={styles.cardLabel}>{card.label}</Text>
            <Text style={styles.cardValue}>{card.value}</Text>
          </View>
        ))}
      </View>

      <Link href="/ess" asChild>
        <Pressable style={styles.secondary}>
          <Text style={styles.secondaryText}>Staff tools</Text>
        </Pressable>
      </Link>

      <Pressable
        style={styles.logout}
        onPress={async () => {
          await clearSession();
          router.replace("/landing");
        }}
      >
        <Text style={styles.logoutText}>Sign out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bgPrimary },
  container: { flex: 1, padding: 24, backgroundColor: colors.bgPrimary },
  hello: { fontSize: 24, fontWeight: "800", color: colors.heading },
  hint: { marginTop: 6, marginBottom: 16, color: colors.body },
  error: { color: colors.danger, marginBottom: 12 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  card: {
    width: "47%",
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
  },
  cardLabel: { color: colors.body, fontSize: 13 },
  cardValue: { marginTop: 6, fontSize: 22, fontWeight: "700", color: colors.heading },
  secondary: {
    marginTop: 20,
    backgroundColor: colors.brand,
    borderRadius: 12,
    paddingVertical: 14,
  },
  secondaryText: { color: colors.white, textAlign: "center", fontWeight: "700" },
  logout: { marginTop: 12, paddingVertical: 12 },
  logoutText: { textAlign: "center", color: colors.muted, fontWeight: "600" },
});
