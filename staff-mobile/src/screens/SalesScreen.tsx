import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { replacePath, pushPath } from "@/lib/nav";
import { api, getSession } from "@/lib/api";
import { canAccess } from "@/lib/rbac";
import { type Theme, useTheme } from "@/theme";
import { useToast } from "@/components/toast";
import ListToolbar, { emptyStaffFilters } from "@/components/list-toolbar";
import {
  applyListingFilters,
  type ListingFilterState,
} from "@/lib/listingFilters";
import { formatDecimal } from "@/lib/decimal";

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
  const theme = useTheme();
  const toast = useToast();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Filters>(emptyStaffFilters());

  const load = useCallback(async () => {
    try {
      const s = await getSession();
      if (!s) {
        replacePath("/landing");
        return;
      }
      if (!canAccess(s, "pos")) {
        replacePath("/app/dashboard");
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
  }, [filters.categories, toast]);

  useEffect(() => {
    // `load` sets no state before its first await — the only setState is
    // `setLoading(false)` in a `finally`, well after the fetch resolves — so
    // there is no synchronous cascade here for the rule to catch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
        <ActivityIndicator color={theme.brand} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>Sales</Text>
        <Pressable style={styles.posBtn} onPress={() => pushPath("/app/pos")}>
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
                    <Text style={styles.amount}>Rs {formatDecimal(sale.total_amount)}</Text>
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

function createStyles(t: Theme) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: t.bgPrimary },
    center: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: t.bgPrimary,
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingTop: 12,
    },
    title: { fontSize: 22, fontWeight: "800", color: t.heading },
    posBtn: {
      backgroundColor: t.brand,
      borderRadius: t.radiusLg,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    posBtnText: { color: t.white, fontWeight: "700", fontSize: 13 },
    listShell: {
      flex: 1,
      marginHorizontal: 16,
      marginTop: 12,
      marginBottom: 16,
      backgroundColor: t.card,
      borderRadius: t.radiusLg,
      borderWidth: 1,
      borderColor: t.border,
      padding: 14,
      overflow: "hidden",
    },
    list: { gap: 10, paddingBottom: 16 },
    empty: { color: t.muted, textAlign: "center", marginTop: 24 },
    rowCard: {
      backgroundColor: t.bgSecondary,
      borderRadius: t.radiusLg,
      borderWidth: 1,
      borderColor: t.border,
      padding: 14,
      marginBottom: 10,
    },
    card: {
      backgroundColor: t.card,
      borderRadius: t.radiusLg,
      borderWidth: 1,
      borderColor: t.border,
      padding: 14,
      marginBottom: 10,
    },
    row: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 4,
    },
    invoice: { fontWeight: "800", color: t.heading },
    amount: { fontWeight: "700", color: t.heading },
    meta: { color: t.body, fontSize: 13 },
    advance: {
      marginTop: 10,
      alignSelf: "flex-start",
      borderWidth: 1,
      borderColor: t.brand,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    advanceText: { color: t.brand, fontWeight: "700", fontSize: 13 },
  });
}
