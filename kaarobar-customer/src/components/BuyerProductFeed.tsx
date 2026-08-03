import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useNavigation } from "@react-navigation/native";
import type { NavigationProp, ParamListBase } from "@react-navigation/native";
import { api, colors } from "../lib/api";
import { t } from "../lib/i18n";
import { pushPath } from "../lib/nav";
import { marketplaceKeys } from "../lib/queryClient";
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

function filtersKey(filters: MarketplaceFeedFilters): Record<string, unknown> {
  return {
    search: filters.search.trim(),
    categories: [...filters.categories].sort(),
    industries: [...filters.industries].sort(),
    priceMin: filters.priceMin.trim(),
    priceMax: filters.priceMax.trim(),
  };
}

/** Paginated cross-business product feed for Discover / Products. */
export default function BuyerProductFeed({ ListHeaderComponent }: Props) {
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const palette = useBrandPalette();
  const styles = useMemo(() => createStyles(palette), [palette]);

  const [filters, setFilters] = useState<MarketplaceFeedFilters>(
    emptyMarketplaceFeedFilters()
  );
  const [debouncedFilters, setDebouncedFilters] = useState(filters);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedFilters(filters), 220);
    return () => clearTimeout(timer);
  }, [filters]);

  const productsQuery = useInfiniteQuery({
    queryKey: marketplaceKeys.products(filtersKey(debouncedFilters)),
    queryFn: async ({ pageParam }) => {
      const path = marketplaceProductsQuery(debouncedFilters, {
        cursor: pageParam,
        limit: PAGE_SIZE,
      });
      const res = await api<{
        data: MarketplaceFeedProduct[];
        meta?: MarketplaceFeedMeta;
      }>(path, {}, null);
      return {
        data: Array.isArray(res.data) ? res.data : [],
        meta: res.meta ?? { limit: PAGE_SIZE, next_cursor: null },
      };
    },
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.meta.next_cursor ?? undefined,
  });

  const businessesQuery = useQuery({
    queryKey: marketplaceKeys.businesses({}),
    queryFn: async () => {
      const res = await api<{ data: { industry?: string | null }[] }>(
        "/marketplace/businesses",
        {},
        null
      );
      return res.data || [];
    },
  });

  const products = useMemo(
    () => productsQuery.data?.pages.flatMap((p) => p.data) ?? [],
    [productsQuery.data]
  );

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const p of products) {
      if (p.category?.trim()) set.add(p.category.trim());
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [products]);

  const industries = useMemo(() => {
    const set = new Set<string>();
    for (const b of businessesQuery.data || []) {
      if (b.industry?.trim()) set.add(b.industry.trim());
    }
    for (const p of products) {
      if (p.industry?.trim()) set.add(p.industry.trim());
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [businessesQuery.data, products]);

  const loading = productsQuery.isLoading;
  const loadingMore = productsQuery.isFetchingNextPage;
  const errorMessage =
    productsQuery.error instanceof Error
      ? productsQuery.error.message
      : productsQuery.error
        ? t("common.loadFailed")
        : null;
  const hasNextPage = productsQuery.hasNextPage;

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
      {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}
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
        hasNextPage ? (
          <Pressable
            style={styles.loadMore}
            onPress={() => void productsQuery.fetchNextPage()}
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

function createStyles(_palette: { brand: string; brandSoft: string }) {
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
