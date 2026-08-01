import { useCallback, useMemo, useState } from "react";
import { useBrandPalette } from "../lib/BrandThemeContext";
import {
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
import { BuyerDiscoverSkeleton } from "./BuyerSkeletons";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import type { NavigationProp, ParamListBase } from "@react-navigation/native";
import { pushPath } from "../lib/nav";
import {
  applyListingFilters,
  emptyListingFilters,
  type ListingFilterState,
} from "../lib/listingFilters";
import { t } from "../lib/i18n";

type Biz = {
  id: string;
  name: string;
  industry?: string | null;
  marketplace_slug?: string | null;
  tagline?: string | null;
  logo_url?: string | null;
  primary_color?: string | null;
  marketplace_description?: string | null;
  appointments_enabled?: boolean;
  commerce_mode?: string | null;
};

/** Buyer home on `/app/dashboard` — discover marketplace stores. */
export default function BuyerDiscover() {
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const palette = useBrandPalette();
  const styles = useMemo(() => createStyles(palette), [palette]);
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
      <View style={[styles.hero, { borderColor: palette.brandSoft }]}>
        <Text style={styles.title}>{t("pages.discoverTitle")}</Text>
        <Text style={styles.hint}>{t("pages.discoverDesc")}</Text>
      </View>
      <TextInput
        style={styles.search}
        placeholder={t("marketplace.searchStores")}
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
        <BuyerDiscoverSkeleton />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 40, gap: 14 }}
          ListEmptyComponent={
            <Text style={styles.empty}>
              {businesses.length === 0
                ? t("marketplace.emptyDiscover")
                : t("marketplace.noFilterMatches")}
            </Text>
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() =>
                pushPath(
                  navigation,
                  `/app/market/${item.marketplace_slug || item.id}`
                )
              }
              style={[
                styles.card,
                item.primary_color
                  ? { borderTopColor: item.primary_color, borderTopWidth: 4 }
                  : { borderTopColor: palette.brand, borderTopWidth: 4 },
              ]}
            >
              <View style={styles.cardRow}>
                <View
                  style={[
                    styles.logo,
                    item.primary_color
                      ? { backgroundColor: `${item.primary_color}22` }
                      : { backgroundColor: palette.brandSoft },
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
                  <Text
                    style={[
                      styles.cardSub,
                      item.primary_color
                        ? { color: item.primary_color }
                        : { color: palette.brand },
                    ]}
                  >
                    {item.industry || "store"}
                  </Text>
                  {item.marketplace_description ? (
                    <Text style={styles.desc} numberOfLines={2}>
                      {item.marketplace_description}
                    </Text>
                  ) : null}
                  <Text style={[styles.shopNow, { color: palette.brand }]}>
                    {item.appointments_enabled || item.commerce_mode === "appointments"
                      ? t("marketplace.bookNow")
                      : t("marketplace.shopNow")}{" "}
                    →
                  </Text>
                </View>
              </View>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

function createStyles(palette: import("../lib/brandTheme").BrandPalette) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgPrimary, padding: 16 },
  hero: {
    borderRadius: 18,
    borderWidth: 1,
    backgroundColor: colors.card,
    padding: 16,
    marginBottom: 14,
  },
  title: { fontSize: 26, fontWeight: "800", color: colors.heading, letterSpacing: -0.3 },
  hint: { color: colors.body, marginTop: 6, lineHeight: 20 },
  search: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 14,
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
  chipOn: { backgroundColor: palette.brand, borderColor: palette.brand },
  chipText: { fontSize: 12, fontWeight: "700", color: colors.heading },
  chipTextOn: { color: palette.brandForeground },
  error: { color: colors.danger, marginBottom: 8 },
  empty: { color: colors.body, marginTop: 16 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    overflow: "hidden",
  },
  cardRow: { flexDirection: "row", gap: 12 },
  logo: {
    width: 60,
    height: 60,
    borderRadius: 14,
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
    textTransform: "uppercase",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.6,
  },
  desc: { marginTop: 6, color: colors.body, fontSize: 13 },
  shopNow: { marginTop: 8, fontWeight: "700", fontSize: 13 },
});
}
