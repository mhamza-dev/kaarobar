import { useEffect, useState } from "react";
import { Link, router } from "expo-router";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  api,
  clearSession,
  colors,
  getSession,
  setSession,
  type Session,
} from "../lib/api";

type Dashboard = {
  sales_today: string;
  cash_position: string;
  low_stock_count: number;
  pending_approvals: number;
};

type Business = { id: string; name: string };
type Branch = { id: string; name: string };

export default function DashboardScreen() {
  const [session, setLocal] = useState<Session | null>(null);
  const [dash, setDash] = useState<Dashboard | null>(null);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function hydrate(s: Session) {
    const bizRes = await api<{ data: Business[] }>("/businesses", {}, s);
    const list = bizRes.data || [];
    setBusinesses(list);

    let next = s;
    if (list[0] && !s.business_id) {
      next = { ...s, business_id: list[0].id };
    }

    if (next.business_id) {
      const br = await api<{ data: Branch[] }>(
        `/businesses/${next.business_id}/branches`,
        {},
        next
      );
      setBranches(br.data || []);
      if (br.data?.[0] && !next.branch_id) {
        next = { ...next, branch_id: br.data[0].id };
      }
    }

    await setSession(next);
    setLocal(next);

    try {
      const res = await api<{ data: Dashboard }>("/reports/dashboard", {}, next);
      setDash(res.data);
    } catch {
      setDash(null);
    }
  }

  useEffect(() => {
    (async () => {
      const s = await getSession();
      if (!s) {
        router.replace("/landing");
        return;
      }
      setLocal(s);
      try {
        await hydrate(s);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      }
    })();
  }, []);

  async function selectBusiness(business_id: string) {
    if (!session) return;
    const next = { ...session, business_id, branch_id: undefined };
    await setSession(next);
    setLocal(next);
    try {
      const br = await api<{ data: Branch[] }>(
        `/businesses/${business_id}/branches`,
        {},
        next
      );
      setBranches(br.data || []);
      if (br.data?.[0]) {
        const withBranch = { ...next, branch_id: br.data[0].id };
        await setSession(withBranch);
        setLocal(withBranch);
        const res = await api<{ data: Dashboard }>(
          "/reports/dashboard",
          {},
          withBranch
        );
        setDash(res.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to switch business");
    }
  }

  async function selectBranch(branch_id: string) {
    if (!session) return;
    const next = { ...session, branch_id };
    await setSession(next);
    setLocal(next);
    try {
      const res = await api<{ data: Dashboard }>("/reports/dashboard", {}, next);
      setDash(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to switch branch");
    }
  }

  if (!session) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  }

  const links = [
    { href: "/pos", title: "POS", subtitle: "Checkout & tills" },
    { href: "/returns", title: "Returns", subtitle: "Refunds & approvals" },
    { href: "/inventory", title: "Inventory", subtitle: "Stock & procurement" },
    { href: "/ess", title: "Staff tools", subtitle: "Attendance & leave" },
  ] as const;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <Text style={styles.hello}>Welcome, {session.user.name}</Text>
      <Text style={styles.hint}>Sales, cash, stock, and approvals across your shops.</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Text style={styles.section}>Business</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.chips}>
          {businesses.map((b) => (
            <Pressable
              key={b.id}
              style={[
                styles.chip,
                session.business_id === b.id && styles.chipActive,
              ]}
              onPress={() => selectBusiness(b.id)}
            >
              <Text
                style={[
                  styles.chipText,
                  session.business_id === b.id && styles.chipTextActive,
                ]}
              >
                {b.name}
              </Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      <Text style={styles.section}>Branch</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.chips}>
          {branches.map((b) => (
            <Pressable
              key={b.id}
              style={[styles.chip, session.branch_id === b.id && styles.chipActive]}
              onPress={() => selectBranch(b.id)}
            >
              <Text
                style={[
                  styles.chipText,
                  session.branch_id === b.id && styles.chipTextActive,
                ]}
              >
                {b.name}
              </Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>

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

      {links.map((item) => (
        <Link key={item.href} href={item.href} asChild>
          <Pressable style={styles.navCard}>
            <Text style={styles.navTitle}>{item.title}</Text>
            <Text style={styles.navSub}>{item.subtitle}</Text>
          </Pressable>
        </Link>
      ))}

      <Pressable
        style={styles.logout}
        onPress={async () => {
          await clearSession();
          router.replace("/landing");
        }}
      >
        <Text style={styles.logoutText}>Sign out</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bgPrimary,
  },
  container: { flex: 1, padding: 24, backgroundColor: colors.bgPrimary },
  hello: { fontSize: 24, fontWeight: "800", color: colors.heading },
  hint: { marginTop: 6, marginBottom: 16, color: colors.body },
  error: { color: colors.danger, marginBottom: 12 },
  section: {
    marginTop: 8,
    marginBottom: 8,
    fontSize: 12,
    fontWeight: "700",
    color: colors.muted,
    textTransform: "uppercase",
  },
  chips: { flexDirection: "row", gap: 8, marginBottom: 8 },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.card,
  },
  chipActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  chipText: { color: colors.heading, fontWeight: "600" },
  chipTextActive: { color: colors.white },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 12 },
  card: {
    width: "47%",
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
  },
  cardLabel: { color: colors.body, fontSize: 13 },
  cardValue: {
    marginTop: 6,
    fontSize: 22,
    fontWeight: "700",
    color: colors.heading,
  },
  navCard: {
    marginTop: 12,
    backgroundColor: colors.brand,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  navTitle: { color: colors.white, fontWeight: "800", fontSize: 16 },
  navSub: { color: "#bfdbfe", marginTop: 2, fontSize: 13 },
  logout: { marginTop: 16, paddingVertical: 12 },
  logoutText: { textAlign: "center", color: colors.muted, fontWeight: "600" },
});
