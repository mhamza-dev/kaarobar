import { useCallback, useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NavigationProp, ParamListBase } from "@react-navigation/native";
import { api, colors } from "../lib/api";
import { t } from "../lib/i18n";
import { pushPath } from "../lib/nav";
import {
  applyListingFilters,
  emptyListingFilters,
  type ListingFilterState,
} from "../lib/listingFilters";
import { useBrandPalette } from "../lib/BrandThemeContext";
import BuyerNav from "../components/BuyerNav";
import { BuyerEmptyPanel, BuyerHero } from "../components/BuyerLayout";
import BuyerProductCard, {
  type MarketplaceProductCardItem,
} from "../components/BuyerProductCard";
import { BuyerProductGridSkeleton } from "../components/BuyerSkeletons";

type FeedProduct = MarketplaceProductCardItem & {
  sku?: string | null;
  description?: string | null;
  industry?: string | null;
  marketplace_slug?: string | null;
  product_kind?: string | null;
};

/** Cross-business product feed. */
export default function ProductsScreen() {
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const palette = useBrandPalette();
  const [filters, setFilters] = useState<ListingFilterState>(emptyListingFilters());
  const [products, setProducts] = useState<FeedProduct[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [apiReady, setApiReady] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      const timer = setTimeout(() => {
        setLoading(true);
        const q = filters.search.trim();
        const params = new URLSearchParams();
        if (q) params.set("q", q);
        const qs = params.toString();
        void api<{ data: FeedProduct[] }>(
          `/marketplace/products${qs ? `?${qs}` : ""}`,
          {},
          null
        )
          .then((res) => {
            if (cancelled) return;
            setProducts(Array.isArray(res.data) ? res.data : []);
            setError(null);
            setApiReady(true);
          })
          .catch((err) => {
            if (cancelled) return;
            const message = err instanceof Error ? err.message : t("common.loadFailed");
            const notReady =
              /not_found|404|undefined|route/i.test(message) ||
              message === "Failed to fetch" ||
              message === "Network request failed";
            setApiReady(!notReady);
            setProducts([]);
            setError(notReady ? null : message);
          })
          .finally(() => {
            if (!cancelled) setLoading(false);
          });
      }, 200);
      return () => {
        cancelled = true;
        clearTimeout(timer);
      };
    }, [filters.search])
  );

  const industryOptions = useMemo(() => {
    const set = new Set<string>();
    for (const p of products) {
      if (p.industry?.trim()) set.add(p.industry.trim());
      const cat = p.category_ref?.name || p.category;
      if (cat?.trim()) set.add(cat.trim());
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [products]);

  const filtered = useMemo(
    () =>
      applyListingFilters(products, { ...filters, search: "" }, {
        searchText: () => "",
        category: (p) => p.industry || p.category_ref?.name || p.category || "",
        price: (p) => Number(p.price || 0),
      }),
    [products, filters]
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
      <FlatList
        data={loading ? [] : filtered}
        keyExtractor={(item) => `${item.marketplace_slug || item.business_id}:${item.id}`}
        numColumns={2}
        columnWrapperStyle={styles.gridRow}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View>
            <BuyerHero
              eyebrow={t("marketplace.eyebrow")}
              title={t("pages.productsTitle")}
              description={t("pages.productsDesc")}
            >
              <Text style={styles.heroExtra}>{t("marketplace.productsHero")}</Text>
            </BuyerHero>
            <TextInput
              style={styles.search}
              placeholder={t("marketplace.searchAllProducts")}
              placeholderTextColor={colors.muted}
              value={filters.search}
              onChangeText={(search) => setFilters((f) => ({ ...f, search }))}
            />
            {industryOptions.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.chips}
              >
                {industryOptions.map((cat) => {
                  const on = filters.categories.includes(cat);
                  return (
                    <Pressable
                      key={cat}
                      style={[
                        styles.chip,
                        on && { backgroundColor: palette.brand, borderColor: palette.brand },
                      ]}
                      onPress={() => toggleIndustry(cat)}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          on && { color: palette.brandForeground },
                        ]}
                      >
                        {cat}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            ) : null}
            {error ? <Text style={styles.error}>{error}</Text> : null}
            {loading ? <BuyerProductGridSkeleton /> : null}
          </View>
        }
        ListEmptyComponent={
          loading ? null : (
            <BuyerEmptyPanel
              title={
                products.length === 0
                  ? t("marketplace.emptyProductsTitle")
                  : t("common.noResults")
              }
              body={
                products.length === 0
                  ? apiReady
                    ? t("marketplace.emptyProductsBody")
                    : t("marketplace.productsApiUnavailable")
                  : t("marketplace.noFilterMatches")
              }
              actionLabel={t("marketplace.browseStores")}
              onAction={() => pushPath(navigation, "/app/dashboard")}
            />
          )
        }
        renderItem={({ item }) => {
          const storeKey = item.marketplace_slug || item.business_id || "";
          return (
            <View style={styles.gridItem}>
              <BuyerProductCard
                product={{
                  ...item,
                  business_slug: item.marketplace_slug,
                }}
                showStore
                accent={item.primary_color}
                onPress={() =>
                  pushPath(navigation, `/app/market/${storeKey}/product/${item.id}`)
                }
              />
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgPrimary },
  content: { padding: 16, paddingBottom: 40 },
  heroExtra: { marginTop: 8, color: colors.body, fontSize: 13, lineHeight: 18 },
  search: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: colors.radiusLg,
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
  chipText: { fontSize: 12, fontWeight: "700", color: colors.heading },
  error: { color: colors.danger, marginBottom: 8 },
  gridRow: { gap: 12 },
  gridItem: { flex: 1, maxWidth: "50%", marginBottom: 12 },
});
