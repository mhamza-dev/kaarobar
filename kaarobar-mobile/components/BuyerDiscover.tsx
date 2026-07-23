import { useCallback, useMemo, useState } from "react";
import { Link, useFocusEffect } from "expo-router";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { api, colors } from "../lib/api";
import BuyerNav from "./BuyerNav";
import {
  applyListingFilters,
  emptyListingFilters,
  type ListingFilterState,
} from "../lib/listingFilters";

type Biz = {
  id: string;
  name: string;
  industry?: string | null;
  marketplace_slug?: string | null;
  tagline?: string | null;
  logo_url?: string | null;
  primary_color?: string | null;
  marketplace_description?: string | null;
};

/** Buyer home on `/app/dashboard` — discover marketplace stores. */
export default function BuyerDiscover() {
  const [filters, setFilters] = useState<ListingFilterState>(emptyListingFilters());
  const [businesses, setBusinesses] = useState<Biz[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        setLoading(true);
        try {
          const q = filters.search.trim();
          const res = await api<{ data: Biz[] }>(
            `/marketplace/businesses${q ? `?q=${encodeURIComponent(q)}` : ""}`,
            {},
            null
          );
          if (!cancelled) {
            setBusinesses(res.data || []);
            setError(null);
          }
        } catch (err) {
          if (!cancelled) {
            setError(err instanceof Error ? err.message : "Failed to load");
          }
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [filters.search])
  );

  const industryOptions = useMemo(() => {
    const set = new Set<string>();
    for (const b of businesses) {
      if (b.industry?.trim()) set.add(b.industry.trim());
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [businesses]);

  const filtered = useMemo(
    () =>
      applyListingFilters(businesses, { ...filters, search: "" }, {
        searchText: () => "",
        category: (b) => b.industry || "",
      }),
    [businesses, filters]
  );

  function toggleIndustry(cat: string) {
    setFilters((prev) => ({
      ...prev,
      categories: prev.categories.includes(cat)
        ? prev.categories.filter((c) => c !== cat)
        : [...prev.categories, cat],
    }));
  }

  return (
    <View style={styles.container}>
      <BuyerNav />
      <Text style={styles.title}>Discover stores</Text>
      <Text style={styles.hint}>Browse branded Kaarobar businesses and place pickup orders.</Text>
      <TextInput
        style={styles.search}
        placeholder="Search by name or industry"
        placeholderTextColor={colors.muted}
        value={filters.search}
        onChangeText={(search) => setFilters((f) => ({ ...f, search }))}
      />
      {industryOptions.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips}>
          {industryOptions.map((cat) => {
            const on = filters.categories.includes(cat);
            return (
              <Pressable
                key={cat}
                style={[styles.chip, on && styles.chipOn]}
                onPress={() => toggleIndustry(cat)}
              >
                <Text style={[styles.chipText, on && styles.chipTextOn]}>{cat}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loading ? (
        <ActivityIndicator color={colors.brand} style={{ marginTop: 24 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 40, gap: 12 }}
          ListEmptyComponent={
            <Text style={styles.empty}>
              {businesses.length === 0
                ? "No marketplace stores listed yet."
                : "No matches for these filters."}
            </Text>
          }
          renderItem={({ item }) => (
            <Link href={`/app/market/${item.marketplace_slug || item.id}`} asChild>
              <Pressable
                style={[
                  styles.card,
                  item.primary_color
                    ? { borderTopColor: item.primary_color, borderTopWidth: 3 }
                    : null,
                ]}
              >
                <View style={styles.cardRow}>
                  <View
                    style={[
                      styles.logo,
                      item.primary_color
                        ? { backgroundColor: `${item.primary_color}22` }
                        : null,
                    ]}
                  >
                    {item.logo_url ? (
                      <Image source={{ uri: item.logo_url }} style={styles.logoImg} />
                    ) : (
                      <Text style={styles.logoLetter}>
                        {(item.name || "?").slice(0, 1).toUpperCase()}
                      </Text>
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{item.name}</Text>
                    {item.tagline ? (
                      <Text style={styles.tagline} numberOfLines={1}>
                        {item.tagline}
                      </Text>
                    ) : null}
                    <Text style={styles.cardSub}>{item.industry || "store"}</Text>
                    {item.marketplace_description ? (
                      <Text style={styles.desc} numberOfLines={2}>
                        {item.marketplace_description}
                      </Text>
                    ) : null}
                  </View>
                </View>
              </Pressable>
            </Link>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgPrimary, padding: 16 },
  title: { fontSize: 24, fontWeight: "800", color: colors.heading },
  hint: { color: colors.body, marginTop: 4, marginBottom: 12 },
  search: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
    color: colors.heading,
  },
  chips: { maxHeight: 40, marginBottom: 12 },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    backgroundColor: colors.card,
  },
  chipOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  chipText: { fontSize: 12, fontWeight: "700", color: colors.heading },
  chipTextOn: { color: colors.white },
  error: { color: colors.danger, marginBottom: 8 },
  empty: { color: colors.body, marginTop: 16 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },
  cardRow: { flexDirection: "row", gap: 12 },
  logo: {
    width: 56,
    height: 56,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgSecondary || colors.card,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  logoImg: { width: "100%", height: "100%" },
  logoLetter: { fontSize: 20, fontWeight: "800", color: colors.heading },
  cardTitle: { fontSize: 17, fontWeight: "800", color: colors.heading },
  tagline: { marginTop: 2, color: colors.body, fontSize: 13 },
  cardSub: {
    marginTop: 6,
    color: colors.muted,
    textTransform: "uppercase",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.6,
  },
  desc: { marginTop: 6, color: colors.body, fontSize: 13 },
});
