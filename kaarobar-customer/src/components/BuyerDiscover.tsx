import { useCallback, useMemo, useState } from "react";
import {
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NavigationProp, ParamListBase } from "@react-navigation/native";
import { api, colors } from "../lib/api";
import { t } from "../lib/i18n";
import { pushPath } from "../lib/nav";
import { useBrandPalette } from "../lib/BrandThemeContext";
import BuyerNav from "./BuyerNav";
import { BuyerEmptyPanel, BuyerHero } from "./BuyerLayout";
import { BuyerDiscoverSkeleton } from "./BuyerSkeletons";
import BuyerProductFeed from "./BuyerProductFeed";
import MarketplaceFilterBar from "./MarketplaceFilterBar";
import {
  emptyMarketplaceFeedFilters,
  type MarketplaceFeedFilters,
} from "../lib/marketplaceFeed";

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

type Mode = "products" | "shops";

/** Product-first Discover with Shops browse toggle. */
export default function BuyerDiscover() {
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const palette = useBrandPalette();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const [mode, setMode] = useState<Mode>("products");
  const [shopFilters, setShopFilters] = useState<MarketplaceFeedFilters>(
    emptyMarketplaceFeedFilters()
  );
  const [businesses, setBusinesses] = useState<Biz[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loadingShops, setLoadingShops] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (mode !== "shops") return;
      let cancelled = false;
      (async () => {
        setLoadingShops(true);
        try {
          const q = shopFilters.search.trim();
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
            setError(err instanceof Error ? err.message : t("common.loadFailed"));
          }
        } finally {
          if (!cancelled) setLoadingShops(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [mode, shopFilters.search])
  );

  const industries = useMemo(() => {
    const set = new Set<string>();
    for (const b of businesses) {
      if (b.industry?.trim()) set.add(b.industry.trim());
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [businesses]);

  const filteredShops = useMemo(
    () =>
      businesses.filter(
        (b) =>
          shopFilters.industries.length === 0 ||
          shopFilters.industries.includes(b.industry ?? "")
      ),
    [businesses, shopFilters.industries]
  );

  const hero = (
    <View style={styles.heroWrap}>
      <BuyerHero
        eyebrow={t("marketplace.eyebrow")}
        title={t("pages.discoverTitle")}
        description={t("marketplace.discoverProductsHero")}
      />
      <View style={styles.modeRow}>
        <Pressable
          onPress={() => setMode("products")}
          style={[styles.modeBtn, mode === "products" && styles.modeOn]}
        >
          <Text
            style={[styles.modeText, mode === "products" && styles.modeTextOn]}
          >
            {t("marketplace.modeProducts")}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setMode("shops")}
          style={[styles.modeBtn, mode === "shops" && styles.modeOn]}
        >
          <Text style={[styles.modeText, mode === "shops" && styles.modeTextOn]}>
            {t("marketplace.modeShops")}
          </Text>
        </Pressable>
      </View>
      <BuyerNav />
    </View>
  );

  if (mode === "products") {
    return (
      <View style={styles.root}>
        <BuyerProductFeed ListHeaderComponent={hero} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <FlatList
        data={filteredShops}
        keyExtractor={(b) => b.id}
        contentContainerStyle={styles.shopList}
        ListHeaderComponent={
          <View>
            {hero}
            <View style={styles.shopFilters}>
              <MarketplaceFilterBar
                value={shopFilters}
                onChange={setShopFilters}
                industryOptions={industries}
                showCategories={false}
                searchPlaceholder={t("marketplace.searchStores")}
              />
            </View>
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </View>
        }
        ListEmptyComponent={
          loadingShops ? (
            <BuyerDiscoverSkeleton />
          ) : (
            <BuyerEmptyPanel
              title={t("marketplace.emptyStoresTitle")}
              body={
                shopFilters.search || shopFilters.industries.length > 0
                  ? t("marketplace.noFilterMatches")
                  : t("marketplace.emptyStoresBody")
              }
            />
          )
        }
        renderItem={({ item: b }) => (
          <Pressable
            style={styles.shopCard}
            onPress={() =>
              pushPath(navigation, `/app/market/${b.marketplace_slug || b.id}`)
            }
          >
            <View
              style={[
                styles.shopBanner,
                b.primary_color
                  ? { backgroundColor: `${b.primary_color}22` }
                  : null,
              ]}
            >
              <View style={styles.logo}>
                {b.logo_url ? (
                  <Image source={{ uri: b.logo_url }} style={styles.logoImg} />
                ) : (
                  <Text style={styles.logoLetter}>
                    {(b.name || "?").slice(0, 1).toUpperCase()}
                  </Text>
                )}
              </View>
            </View>
            <View style={styles.shopBody}>
              <Text style={styles.shopName}>{b.name}</Text>
              {b.tagline ? (
                <Text style={styles.shopTag} numberOfLines={1}>
                  {b.tagline}
                </Text>
              ) : null}
              <Text style={[styles.shopCta, { color: palette.brand }]}>
                {b.appointments_enabled || b.commerce_mode === "appointments"
                  ? t("marketplace.bookNow")
                  : t("marketplace.shopNow")}{" "}
                →
              </Text>
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}

function createStyles(palette: { brand: string }) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bgPrimary },
    heroWrap: { paddingBottom: 8 },
    modeRow: {
      flexDirection: "row",
      marginHorizontal: 16,
      marginBottom: 8,
      padding: 4,
      borderRadius: 8,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.card,
    },
    modeBtn: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 8,
      alignItems: "center",
    },
    modeOn: { backgroundColor: palette.brand },
    modeText: { fontWeight: "700", fontSize: 13, color: colors.body },
    modeTextOn: { color: "#fff" },
    shopList: { paddingBottom: 24 },
    shopFilters: {
      marginHorizontal: 16,
      marginBottom: 12,
      padding: 12,
      borderRadius: 8,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.card,
    },
    error: { color: colors.danger, marginHorizontal: 16, marginBottom: 8 },
    shopCard: {
      marginHorizontal: 16,
      marginBottom: 12,
      borderRadius: 8,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.card,
      overflow: "hidden",
    },
    shopBanner: { minHeight: 88, justifyContent: "flex-end", padding: 14 },
    logo: {
      width: 56,
      height: 56,
      borderRadius: 8,
      backgroundColor: colors.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
    },
    logoImg: { width: "100%", height: "100%" },
    logoLetter: { fontSize: 20, fontWeight: "800", color: colors.heading },
    shopBody: { padding: 14, gap: 4 },
    shopName: { fontSize: 17, fontWeight: "800", color: colors.heading },
    shopTag: { fontSize: 13, color: colors.body },
    shopCta: { marginTop: 6, fontWeight: "700", fontSize: 13 },
  });
}
