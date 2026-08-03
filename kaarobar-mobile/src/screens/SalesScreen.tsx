import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NavigationProp, ParamListBase } from "@react-navigation/native";
import { replacePath, pushPath } from "../lib/nav";
import { api, colors, getSession } from "../lib/api";
import { canAccess } from "../lib/rbac";
import { useBrandPalette } from "../lib/BrandThemeContext";
import { useToast } from "../components/Toast";
import ListToolbar, { emptyStaffFilters } from "../components/ListToolbar";
import {
  applyListingFilters,
  type ListingFilterState,
} from "../lib/listingFilters";

type SaleRow = {
  id: string;
  invoice_number: string;
  total_amount: string;
  status: string;
  source?: string;
  customer_name?: string | null;
  inserted_at?: string;
};

type Filters = ListingFilterState & {
  status?: string[];
  from?: string;
  to?: string;
};

const ONLINE_NEXT: Record<string, string | null> = {
  Placed: "Confirmed",
  Confirmed: "Ready",
  Ready: "Completed",
};

const SALE_STATUSES = [
  "Completed",
  "Placed",
  "Confirmed",
  "Ready",
  "Voided",
  "Refunded",
];

function inDateRange(iso: string | undefined, from?: string, to?: string) {
  if (!iso) return !(from || to);
  const day = iso.slice(0, 10);
  if (from && day < from) return false;
  if (to && day > to) return false;
  return true;
}

/** Staff sales list with search + filter sheet (POS-FR listing). */
export default function SalesScreen() {
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const palette = useBrandPalette();
  const toast = useToast();
  const styles = useMemo(() => createStyles(palette.brand), [palette.brand]);
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Filters>(emptyStaffFilters());

  const load = useCallback(async () => {
    try {
      const s = await getSession();
      if (!s) {
        replacePath(navigation, "/landing");
        return;
      }
      if (!canAccess(s, "pos")) {
        replacePath(navigation, "/app/dashboard");
        return;
      }
      const source =
        filters.categories.length === 1 ? filters.categories[0] : null;
      const q =
        source && (source === "online" || source === "pos")
          ? `?source=${encodeURIComponent(source)}`
          : "";
      const res = await api<{ data: SaleRow[] }>(`/sales${q}`);
      setSales(res.data || []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load sales");
    } finally {
      setLoading(false);
    }
  }, [filters.categories, navigation, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    let rows = applyListingFilters(sales, filters, {
      searchText: (s) => `${s.invoice_number} ${s.customer_name || ""}`,
      category: (s) => s.source || "pos",
    });
    if (filters.status?.length) {
      const set = new Set(filters.status);
      rows = rows.filter((s) => set.has(s.status));
    }
    if (filters.from || filters.to) {
      rows = rows.filter((s) => inDateRange(s.inserted_at, filters.from, filters.to));
    }
    return rows;
  }, [sales, filters]);

  async function advanceOnline(sale: SaleRow) {
    const next = ONLINE_NEXT[sale.status];
    if (!next) return;
    try {
      await api(`/sales/${sale.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: next }),
      });
      toast.success(`Order ${sale.invoice_number} → ${next}`);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Status update failed");
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={palette.brand} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>Sales</Text>
        <Pressable style={styles.posBtn} onPress={() => pushPath(navigation, "/app/pos")}>
          <Text style={styles.posBtnText}>Open POS</Text>
        </Pressable>
      </View>
      <View style={styles.listShell}>
        <ListToolbar
          value={filters}
          onChange={setFilters}
          searchPlaceholder="Search invoice or customer…"
          embedded
          config={{
            showDateRange: true,
            categoryLabel: "Source",
            categoryOptions: [
              { value: "pos", label: "POS" },
              { value: "online", label: "Online" },
            ],
            statusOptions: SALE_STATUSES.map((s) => ({ value: s, label: s })),
          }}
        />
        <ScrollView contentContainerStyle={styles.list}>
          {filtered.length === 0 ? (
            <Text style={styles.empty}>No sales match these filters.</Text>
          ) : (
            filtered.map((sale) => {
              const next = ONLINE_NEXT[sale.status];
              return (
                <View key={sale.id} style={styles.rowCard}>
                  <View style={styles.row}>
                    <Text style={styles.invoice}>{sale.invoice_number}</Text>
                    <Text style={styles.amount}>Rs {sale.total_amount}</Text>
                  </View>
                  <Text style={styles.meta}>
                    {sale.customer_name || "Walk-in"} · {sale.status}
                    {sale.source ? ` · ${sale.source}` : ""}
                  </Text>
                  {next ? (
                    <Pressable style={styles.advance} onPress={() => advanceOnline(sale)}>
                      <Text style={styles.advanceText}>Mark {next}</Text>
                    </Pressable>
                  ) : null}
                </View>
              );
            })
          )}
        </ScrollView>
      </View>
    </View>
  );
}

function createStyles(brand: string) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bgPrimary },
    center: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.bgPrimary,
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingTop: 12,
    },
    title: { fontSize: 22, fontWeight: "800", color: colors.heading },
    posBtn: {
      backgroundColor: brand,
      borderRadius: colors.radiusLg,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    posBtnText: { color: colors.white, fontWeight: "700", fontSize: 13 },
    listShell: {
      flex: 1,
      marginHorizontal: 16,
      marginTop: 12,
      marginBottom: 16,
      backgroundColor: colors.card,
      borderRadius: colors.radiusLg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
      overflow: "hidden",
    },
    list: { gap: 10, paddingBottom: 16 },
    empty: { color: colors.muted, textAlign: "center", marginTop: 24 },
    rowCard: {
      backgroundColor: colors.bgSecondary,
      borderRadius: colors.radiusLg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
      marginBottom: 10,
    },
    card: {
      backgroundColor: colors.card,
      borderRadius: colors.radiusLg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
      marginBottom: 10,
    },
    row: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 4,
    },
    invoice: { fontWeight: "800", color: colors.heading },
    amount: { fontWeight: "700", color: colors.heading },
    meta: { color: colors.body, fontSize: 13 },
    advance: {
      marginTop: 10,
      alignSelf: "flex-start",
      borderWidth: 1,
      borderColor: brand,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    advanceText: { color: brand, fontWeight: "700", fontSize: 13 },
  });
}
