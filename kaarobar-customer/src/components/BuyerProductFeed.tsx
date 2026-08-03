import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NavigationProp, ParamListBase } from "@react-navigation/native";
import { api, colors } from "../lib/api";
import { t } from "../lib/i18n";
import { pushPath } from "../lib/nav";
import {
  emptyMarketplaceFeedFilters,
  marketplaceProductsQuery,
  storeKeyForProduct,
  type MarketplaceFeedFilters,
  type MarketplaceFeedMeta,
  type MarketplaceFeedProduct,
} from "../lib/marketplaceFeed";
import { useBrandPalette } from "../lib/BrandThemeContext";
import { BuyerEmptyPanel } from "./BuyerLayout";
import BuyerProductCard from "./BuyerProductCard";
import { BuyerProductGridSkeleton } from "./BuyerSkeletons";
import MarketplaceFilterBar from "./MarketplaceFilterBar";

const PAGE_SIZE = 24;

type Props = {
  ListHeaderComponent?: React.ReactElement | null;
};

/** Paginated cross-business product feed for Discover / Products. */
export default function BuyerProductFeed({ ListHeaderComponent }: Props) {
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const palette = useBrandPalette();
  const styles = useMemo(() => createStyles(palette), [palette]);

  const [filters, setFilters] = useState<MarketplaceFeedFilters>(
    emptyMarketplaceFeedFilters()
  );
  const [products, setProducts] = useState<MarketplaceFeedProduct[]>([]);
  const [meta, setMeta] = useState<MarketplaceFeedMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [industries, setIndustries] = useState<string[]>([]);

  const loadPage = useCallback(
    async (cursor: string | null, append: boolean) => {
      if (append) setLoadingMore(true);
      else setLoading(true);
      try {
        const path = marketplaceProductsQuery(filters, {
          cursor,
          limit: PAGE_SIZE,
        });
        const res = await api<{
          data: MarketplaceFeedProduct[];
          meta?: MarketplaceFeedMeta;
        }>(path, {}, null);
        const rows = Array.isArray(res.data) ? res.data : [];
        setProducts((prev) => (append ? [...prev, ...rows] : rows));
        setMeta(res.meta ?? { limit: PAGE_SIZE, next_cursor: null });
        setError(null);
        setCategories((prev) => {
          const set = new Set(append ? prev : []);
          for (const p of rows) {
            if (p.category?.trim()) set.add(p.category.trim());
          }
          return Array.from(set).sort((a, b) => a.localeCompare(b));
        });
        setIndustries((prev) => {
          const set = new Set(prev);
          for (const p of rows) {
            if (p.industry?.trim()) set.add(p.industry.trim());
          }
          return Array.from(set).sort((a, b) => a.localeCompare(b));
        });
      } catch (err) {
        if (!append) {
          setProducts([]);
          setMeta(null);
        }
        setError(err instanceof Error ? err.message : t("common.loadFailed"));
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [filters]
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadPage(null, false);
    }, 220);
    return () => clearTimeout(timer);
  }, [loadPage]);

  useEffect(() => {
    void api<{ data: { industry?: string | null }[] }>(
      "/marketplace/businesses",
      {},
      null
    )
      .then((res) => {
        const set = new Set<string>();
        for (const b of res.data || []) {
          if (b.industry?.trim()) set.add(b.industry.trim());
        }
        setIndustries((prev) =>
          Array.from(new Set([...prev, ...set])).sort((a, b) =>
            a.localeCompare(b)
          )
        );
      })
      .catch(() => undefined);
  }, []);

  const nextCursor = meta?.next_cursor ?? null;

  const filterBar = (
    <View style={styles.filterWrap}>
      <MarketplaceFilterBar
        value={filters}
        onChange={setFilters}
        industryOptions={industries}
        categoryOptions={categories}
        searchPlaceholder={t("marketplace.searchAllProducts")}
      />
    </View>
  );

  const header = (
    <View>
      {ListHeaderComponent}
      {filterBar}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );

  if (loading && products.length === 0) {
    return (
      <View>
        {header}
        <BuyerProductGridSkeleton />
      </View>
    );
  }

  return (
    <FlatList
      data={products}
      keyExtractor={(p) => `${storeKeyForProduct(p)}:${p.id}`}
      numColumns={2}
      columnWrapperStyle={styles.row}
      contentContainerStyle={styles.list}
      ListHeaderComponent={header}
      ListEmptyComponent={
        <BuyerEmptyPanel
          title={t("marketplace.emptyProductsTitle")}
          body={
            filters.search ||
            filters.categories.length > 0 ||
            filters.industries.length > 0
              ? t("marketplace.noFilterMatches")
              : t("marketplace.emptyProductsBody")
          }
        />
      }
      ListFooterComponent={
        nextCursor ? (
          <Pressable
            style={styles.loadMore}
            onPress={() => void loadPage(nextCursor, true)}
            disabled={loadingMore}
          >
            {loadingMore ? (
              <ActivityIndicator color={palette.brand} />
            ) : (
              <Text style={[styles.loadMoreText, { color: palette.brand }]}>
                {t("marketplace.loadMore")}
              </Text>
            )}
          </Pressable>
        ) : products.length >= PAGE_SIZE ? (
          <Text style={styles.end}>{t("marketplace.endOfResults")}</Text>
        ) : null
      }
      renderItem={({ item }) => {
        const storeKey = storeKeyForProduct(item);
        return (
          <View style={styles.cardWrap}>
            <BuyerProductCard
              product={{
                ...item,
                business_slug: item.business_slug || item.marketplace_slug,
              }}
              showStore
              onPress={() =>
                pushPath(navigation, `/app/market/${storeKey}/product/${item.id}`)
              }
            />
          </View>
        );
      }}
    />
  );
}

function createStyles(palette: { brand: string; brandSoft: string }) {
  return StyleSheet.create({
    list: { paddingBottom: 24, gap: 0 },
    row: { gap: 10, paddingHorizontal: 16, marginBottom: 10 },
    cardWrap: { flex: 1 },
    filterWrap: {
      marginHorizontal: 16,
      marginBottom: 12,
      padding: 12,
      borderRadius: 8,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.card,
    },
    error: { color: colors.danger, marginHorizontal: 16, marginBottom: 8 },
    loadMore: {
      marginHorizontal: 16,
      marginTop: 8,
      marginBottom: 16,
      paddingVertical: 12,
      borderRadius: 8,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      alignItems: "center",
      backgroundColor: colors.card,
    },
    loadMoreText: { fontWeight: "700", fontSize: 14 },
    end: {
      textAlign: "center",
      color: colors.muted,
      fontSize: 12,
      marginVertical: 12,
    },
  });
}
