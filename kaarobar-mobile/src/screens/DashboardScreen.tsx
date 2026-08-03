import { useCallback, useEffect, useState, useMemo } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  api,
  clearSession,
  colors,
  getSession,
  hydrateSessionContext,
  setSession,
  type Session,
} from "../lib/api";
import { canAccess } from "../lib/rbac";
import { getLocale, loadLocale, setLocale, t, type Locale } from "../lib/i18n";
import { useToast } from "../components/Toast";
import KaarobarLogo from "../components/KaarobarLogo";
import { useBrandTheme } from "../lib/BrandThemeContext";
import { useNavigation } from "@react-navigation/native";
import type { NavigationProp, ParamListBase } from "@react-navigation/native";
import { replacePath, pushPath } from "../lib/nav";

type Dashboard = {
  sales_today: string;
  cash_position: string;
  low_stock_count: number;
  pending_approvals: number;
};

type SalesDayRow = { date: string; total: string; count: number };
type ChartPoint = { date: string; label: string; total: number; count: number };

type Business = { id: string; name: string };
type Branch = { id: string; name: string };

function defaultFrom() {
  const d = new Date();
  d.setDate(d.getDate() - 13);
  return d.toISOString().slice(0, 10);
}

function defaultTo() {
  return new Date().toISOString().slice(0, 10);
}

function toYmd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function fillSalesDays(rows: SalesDayRow[], from: string, to: string): ChartPoint[] {
  const map = new Map(rows.map((r) => [r.date.slice(0, 10), r]));
  const out: ChartPoint[] = [];
  const start = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
    return [];
  }
  const cursor = new Date(start);
  while (cursor <= end) {
    const key = toYmd(cursor);
    const row = map.get(key);
    const [, mm, dd] = key.split("-");
    out.push({
      date: key,
      label: `${mm}/${dd}`,
      total: row ? Number(row.total) || 0 : 0,
      count: row?.count ?? 0,
    });
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

export default function DashboardScreen() {
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const toast = useToast();
  const { palette, refreshStaffBrand } = useBrandTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const [session, setLocal] = useState<Session | null>(null);
  const [dash, setDash] = useState<Dashboard | null>(null);
  const [salesDays, setSalesDays] = useState<SalesDayRow[]>([]);
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [selectedPoint, setSelectedPoint] = useState<ChartPoint | null>(null);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [unread, setUnread] = useState(0);
  const [localeTick, setLocaleTick] = useState(0);

  const loadCharts = useCallback(async (s: Session, rangeFrom: string, rangeTo: string) => {
    if (!canAccess(s, "reports") || !s.business_id || !rangeFrom || !rangeTo) {
      setSalesDays([]);
      return;
    }
    try {
      // RPT-FR-001 — tenant-scoped sales time series
      const res = await api<{ data: SalesDayRow[] }>(
        `/reports/sales-by-day?from=${encodeURIComponent(rangeFrom)}&to=${encodeURIComponent(rangeTo)}`,
        {},
        s
      );
      setSalesDays(res.data || []);
      setSelectedPoint(null);
    } catch {
      setSalesDays([]);
    }
  }, []);

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

    next = await hydrateSessionContext(next);
    await setSession(next);
    setLocal(next);
    refreshStaffBrand();

    if (canAccess(next, "reports")) {
      try {
        const res = await api<{ data: Dashboard }>("/reports/dashboard", {}, next);
        setDash(res.data);
      } catch {
        setDash(null);
      }
      await loadCharts(next, from, to);
    } else {
      setDash(null);
      setSalesDays([]);
    }

    try {
      const countRes = await api<{ data: { unread: number } }>(
        "/notifications/unread-count",
        {},
        next
      );
      setUnread(countRes.data?.unread ?? 0);
    } catch {
      setUnread(0);
    }
  }

  useEffect(() => {
    (async () => {
      await loadLocale();
      const s = await getSession();
      if (!s) {
        replacePath(navigation, "/landing");
        return;
      }
      setLocal(s);
      try {
        await hydrate(s);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t("common.error"));
      }
    })();
  }, []);

  async function selectBusiness(business_id: string) {
    if (!session) return;
    const next = { ...session, business_id, branch_id: undefined };
    await setSession(next);
    setLocal(next);
    refreshStaffBrand();
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
        if (canAccess(withBranch, "reports")) {
          try {
            const res = await api<{ data: Dashboard }>(
              "/reports/dashboard",
              {},
              withBranch
            );
            setDash(res.data);
          } catch {
            setDash(null);
          }
          await loadCharts(withBranch, from, to);
        } else {
          setDash(null);
          setSalesDays([]);
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    }
  }

  async function selectBranch(branch_id: string) {
    if (!session) return;
    const next = { ...session, branch_id };
    await setSession(next);
    setLocal(next);
    if (!canAccess(next, "reports")) {
      setDash(null);
      setSalesDays([]);
    } else {
      try {
        const res = await api<{ data: Dashboard }>("/reports/dashboard", {}, next);
        setDash(res.data);
        await loadCharts(next, from, to);
      } catch (err) {
        const message = err instanceof Error ? err.message : t("common.error");
        if (message === "forbidden_role") {
          setDash(null);
          setSalesDays([]);
        } else {
          toast.error(message);
        }
      }
    }

    try {
      const countRes = await api<{ data: { unread: number } }>(
        "/notifications/unread-count",
        {},
        next
      );
      setUnread(countRes.data?.unread ?? 0);
    } catch {
      setUnread(0);
    }
  }

  if (!session) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={palette.brand} />
      </View>
    );
  }

  const links = [
    { href: "/app/pos", title: t("nav.pos"), subtitle: t("pages.posTitle") },
    { href: "/app/customers", title: t("nav.customers"), subtitle: t("pages.customersTitle") },
    { href: "/app/marketing", title: t("nav.marketing"), subtitle: t("pages.marketingTitle") },
    { href: "/app/returns", title: t("nav.returns"), subtitle: t("pages.returnsTitle") },
    { href: "/app/inventory", title: t("nav.inventory"), subtitle: t("pages.inventoryTitle") },
    {
      href: "/app/leave",
      title: "Leave approvals",
      subtitle: "Approve or reject staff leave",
    },
    {
      href: "/app/notifications",
      title: t("nav.notifications"),
      subtitle:
        unread > 0
          ? `${unread} unread`
          : t("pages.notificationsDesc"),
    },
    { href: "/app/ess", title: t("nav.ess"), subtitle: t("nav.ess") },
    { href: "/app/settings", title: t("nav.settings"), subtitle: t("pages.settingsDesc") },
    { href: "/app/businesses", title: t("nav.businesses"), subtitle: t("pages.businessesDesc") },
  ].filter((item) => {
    if (item.href === "/app/pos" || item.href === "/app/returns") return canAccess(session, "pos");
    if (item.href === "/app/customers") return canAccess(session, "customers");
    if (item.href === "/app/marketing") return canAccess(session, "marketing");
    if (item.href === "/app/inventory") return canAccess(session, "inventory");
    if (item.href === "/app/leave") return canAccess(session, "leave_approve");
    if (item.href === "/app/ess") return canAccess(session, "employee_self");
    if (item.href === "/app/businesses") return canAccess(session, "owner_manage");
    return true;
  });

  const chartPoints = useMemo(() => fillSalesDays(salesDays, from, to), [from, salesDays, to]);
  const canCharts = canAccess(session, "reports");
  const maxRevenue = Math.max(...chartPoints.map((p) => p.total), 1);
  const maxOrders = Math.max(...chartPoints.map((p) => p.count), 1);
  const rangeRevenue = chartPoints.reduce((s, p) => s + p.total, 0);
  const rangeOrders = chartPoints.reduce((s, p) => s + p.count, 0);
  const chartsEmpty = chartPoints.every((p) => p.total === 0 && p.count === 0);

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <Text style={[styles.eyebrow, { color: palette.brand }]}>{t("nav.overview")}</Text>
      <View style={styles.brandRow}>
        <KaarobarLogo size={40} />
        <View>
          <Text style={styles.brandTitle}>{t("common.appName")}</Text>
          <Text style={styles.brandSub}>{t("common.pointOfSale")}</Text>
        </View>
      </View>
      <Text style={styles.hello}>{session.user.name}</Text>
      <Text style={styles.hint}>
        {t("pages.dashboardDesc")}
      </Text>
      <Text style={styles.section}>{t("tenant.business")}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.chips}>
          {businesses.map((b) => (
            <Pressable
              key={b.id}
              style={[
                styles.chip,
                session.business_id === b.id && {
                  backgroundColor: palette.brand,
                  borderColor: palette.brand,
                },
              ]}
              onPress={() => selectBusiness(b.id)}
            >
              <Text
                style={[
                  styles.chipText,
                  session.business_id === b.id && { color: palette.brandForeground },
                ]}
              >
                {b.name}
              </Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      <Text style={styles.section}>{t("tenant.branch")}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.chips}>
          {branches.map((b) => (
            <Pressable
              key={b.id}
              style={[
                styles.chip,
                session.branch_id === b.id && {
                  backgroundColor: palette.brand,
                  borderColor: palette.brand,
                },
              ]}
              onPress={() => selectBranch(b.id)}
            >
              <Text
                style={[
                  styles.chipText,
                  session.branch_id === b.id && { color: palette.brandForeground },
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
          { label: t("desktop.salesToday"), value: dash?.sales_today ?? "—" },
          { label: t("desktop.cashPosition"), value: dash?.cash_position ?? "—" },
          { label: t("desktop.lowStock"), value: String(dash?.low_stock_count ?? "—") },
          { label: t("desktop.approvals"), value: String(dash?.pending_approvals ?? "—") },
        ].map((card) => (
          <View key={card.label} style={styles.card}>
            <Text style={styles.cardLabel}>{card.label}</Text>
            <Text style={styles.cardValue}>{card.value}</Text>
          </View>
        ))}
      </View>

      {canCharts ? (
        <View style={styles.chartBlock}>
          <Text style={styles.section}>{t("dashboard.trendsTitle")}</Text>
          <Text style={styles.chartHint}>{t("dashboard.chartsDesc")}</Text>
          <View style={styles.dateRow}>
            <View style={styles.dateField}>
              <Text style={styles.dateLabel}>{t("common.from")} (YYYY-MM-DD)</Text>
              <TextInput
                value={from}
                onChangeText={setFrom}
                onEndEditing={() => session && loadCharts(session, from, to)}
                placeholder="2026-01-01"
                placeholderTextColor={colors.muted}
                autoCapitalize="none"
                style={styles.dateInput}
              />
            </View>
            <View style={styles.dateField}>
              <Text style={styles.dateLabel}>{t("common.to")} (YYYY-MM-DD)</Text>
              <TextInput
                value={to}
                onChangeText={setTo}
                onEndEditing={() => session && loadCharts(session, from, to)}
                placeholder="2026-01-31"
                placeholderTextColor={colors.muted}
                autoCapitalize="none"
                style={styles.dateInput}
              />
            </View>
          </View>
          <Pressable
            style={[styles.applyBtn, { backgroundColor: palette.brand }]}
            onPress={() => session && loadCharts(session, from, to)}
          >
            <Text style={[styles.applyText, { color: palette.brandForeground }]}>
              {t("listFilters.apply")}
            </Text>
          </Pressable>

          <View style={styles.summaryRow}>
            <View style={styles.summaryCard}>
              <Text style={styles.cardLabel}>{t("dashboard.rangeRevenue")}</Text>
              <Text style={styles.cardValue}>{rangeRevenue.toLocaleString()}</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.cardLabel}>{t("dashboard.rangeOrders")}</Text>
              <Text style={styles.cardValue}>{rangeOrders}</Text>
            </View>
          </View>

          {selectedPoint ? (
            <Text style={styles.selectedHint}>
              {selectedPoint.date}: {selectedPoint.total.toLocaleString()} ·{" "}
              {selectedPoint.count} {t("reports.tickets")}
            </Text>
          ) : null}

          <Text style={styles.chartTitle}>{t("dashboard.revenueOverTime")}</Text>
          {chartsEmpty ? (
            <Text style={styles.emptyChart}>{t("dashboard.noChartData")}</Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={[styles.bars, { minWidth: Math.max(280, chartPoints.length * 22) }]}>
                {chartPoints.map((p) => (
                  <Pressable
                    key={`rev-${p.date}`}
                    style={[styles.barCol, { width: 18 }]}
                    onPress={() => setSelectedPoint(p)}
                  >
                    <View
                      style={[
                        styles.bar,
                        {
                          height: Math.max(4, (p.total / maxRevenue) * 96),
                          backgroundColor: palette.brand,
                          opacity: selectedPoint?.date === p.date ? 1 : 0.75,
                        },
                      ]}
                    />
                    <Text style={styles.barLabel} numberOfLines={1}>
                      {p.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          )}

          <Text style={[styles.chartTitle, { marginTop: 16 }]}>
            {t("dashboard.ordersOverTime")}
          </Text>
          {chartsEmpty ? (
            <Text style={styles.emptyChart}>{t("dashboard.noChartData")}</Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={[styles.bars, { minWidth: Math.max(280, chartPoints.length * 22) }]}>
                {chartPoints.map((p) => (
                  <Pressable
                    key={`ord-${p.date}`}
                    style={[styles.barCol, { width: 18 }]}
                    onPress={() => setSelectedPoint(p)}
                  >
                    <View
                      style={[
                        styles.bar,
                        {
                          height: Math.max(4, (p.count / maxOrders) * 96),
                          backgroundColor: palette.brand,
                          opacity: selectedPoint?.date === p.date ? 1 : 0.75,
                        },
                      ]}
                    />
                    <Text style={styles.barLabel} numberOfLines={1}>
                      {p.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          )}
        </View>
      ) : null}

      {links.map((item) => (
        <Pressable
          key={item.href}
          onPress={() => pushPath(navigation, item.href)}
          style={({ pressed }) => [
            styles.navCard,
            { backgroundColor: palette.brand },
            pressed && styles.navCardPressed,
          ]}
        >
          <Text style={[styles.navTitle, { color: palette.brandForeground }]}>
            {item.title}
          </Text>
          <Text
            style={[
              styles.navSub,
              { color: palette.brandForeground, opacity: 0.75 },
            ]}
          >
            {item.subtitle}
          </Text>
        </Pressable>
      ))}

      <Text style={styles.section}>{t("common.language")}</Text>
      <View style={styles.chips}>
        {(["en", "ur"] as Locale[]).map((code) => {
          void localeTick;
          const active = getLocale() === code;
          return (
            <Pressable
              key={code}
              style={[styles.chip, active && styles.chipActive]}
              onPress={async () => {
                await setLocale(code);
                setLocaleTick((n) => n + 1);
              }}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {code === "ur" ? t("common.urdu") : t("common.english")}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Pressable
        style={styles.logout}
        onPress={async () => {
          await clearSession();
          replacePath(navigation, "/landing");
        }}
      >
        <Text style={[styles.logoutText, { color: palette.brand }]}>{t("common.signOut")}</Text>
      </Pressable>
    </ScrollView>
  );
}

function createStyles(palette: import("../lib/brandTheme").BrandPalette) {
  return StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bgPrimary,
  },
  container: { flex: 1, padding: 24, backgroundColor: colors.bgPrimary },
  eyebrow: {
    fontWeight: "700",
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 10,
  },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 6 },
  brandTitle: { fontSize: 18, fontWeight: "800", color: colors.heading },
  brandSub: { fontSize: 12, color: colors.muted, marginTop: 2 },
  hello: { fontSize: 26, fontWeight: "800", color: colors.heading },
  hint: { marginBottom: 16, color: colors.body, lineHeight: 22 },
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
    borderColor: colors.glassBorder,
    borderRadius: colors.radiusLg,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.glass,
  },
  chipActive: { backgroundColor: palette.brand, borderColor: palette.brand },
  chipText: { color: colors.heading, fontWeight: "600" },
  chipTextActive: { color: colors.white },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 12 },
  card: {
    width: "47%",
    backgroundColor: colors.glass,
    borderColor: colors.glassBorder,
    borderWidth: 1,
    borderRadius: colors.radiusLg,
    padding: 14,
  },
  cardLabel: { color: colors.body, fontSize: 13 },
  cardValue: {
    marginTop: 6,
    fontSize: 22,
    fontWeight: "700",
    color: colors.heading,
  },
  chartBlock: { marginTop: 8 },
  chartHint: { color: colors.body, fontSize: 13, lineHeight: 18, marginBottom: 8 },
  dateRow: { flexDirection: "row", gap: 8 },
  dateField: { flex: 1 },
  dateLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.muted,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  dateInput: {
    borderWidth: 1,
    borderColor: colors.glassBorder,
    borderRadius: colors.radiusLg,
    backgroundColor: colors.glass,
    color: colors.heading,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
  },
  applyBtn: {
    marginTop: 10,
    borderRadius: colors.radiusLg,
    paddingVertical: 10,
    alignItems: "center",
  },
  applyText: { fontWeight: "700", fontSize: 14 },
  summaryRow: { flexDirection: "row", gap: 12, marginTop: 12 },
  summaryCard: {
    flex: 1,
    backgroundColor: colors.glass,
    borderColor: colors.glassBorder,
    borderWidth: 1,
    borderRadius: colors.radiusLg,
    padding: 12,
  },
  selectedHint: {
    marginTop: 10,
    color: colors.heading,
    fontWeight: "600",
    fontSize: 13,
  },
  chartTitle: {
    marginTop: 12,
    marginBottom: 8,
    fontSize: 15,
    fontWeight: "700",
    color: colors.heading,
  },
  emptyChart: { color: colors.muted, fontSize: 13, paddingVertical: 16 },
  bars: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 4,
    minHeight: 120,
    paddingTop: 8,
  },
  barCol: { alignItems: "center", justifyContent: "flex-end" },
  bar: { width: "100%", borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  barLabel: { marginTop: 4, fontSize: 8, color: colors.muted, width: 22, textAlign: "center" },
  navCard: {
    marginTop: 12,
    borderRadius: colors.radiusLg,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  navCardPressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.92,
  },
  navTitle: { fontWeight: "800", fontSize: 16 },
  navSub: { marginTop: 2, fontSize: 13 },
  logout: { marginTop: 16, paddingVertical: 12 },
  logoutText: { textAlign: "center", fontWeight: "600" },
});
}
