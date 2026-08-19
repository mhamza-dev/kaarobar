import { go } from "../lib/nav";
import { useEffect, useMemo, useState } from "react";
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
import { useQuery } from "@tanstack/react-query";
import { api, colors, getSession, isConsumerSession } from "../lib/api";
import { useCart } from "../lib/cart";
import { useToast } from "../components/Toast";
import { brandPaletteFromPrimary } from "../lib/brandTheme";
import BuyerBookFlow from "../components/BuyerBookFlow";
import { BuyerProductGridSkeleton } from "../components/BuyerSkeletons";
import SegmentedTabs from "../components/SegmentedTabs";
import {
  applyListingFilters,
  emptyListingFilters,
  type ListingFilterState,
} from "../lib/listingFilters";
import { marketplaceKeys } from "../lib/queryClient";
import { t } from "../lib/i18n";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { NavigationProp, ParamListBase } from "@react-navigation/native";
import { replacePath, pushPath } from "../lib/nav";
import { formatDecimal } from "../lib/decimal";

type Product = {
  id: string;
  name: string;
  sku?: string;
  price?: string | null;
  image_url?: string | null;
  description?: string | null;
  category?: string | null;
  category_ref?: { id: string; name: string } | null;
  product_kind?: string | null;
  duration_minutes?: number | null;
};

type StaffMember = { id: string; name: string };

type StoreBiz = {
  id: string;
  name: string;
  tagline?: string | null;
  logo_url?: string | null;
  primary_color?: string | null;
  marketplace_description?: string | null;
  industry?: string | null;
  appointments_enabled?: boolean;
  commerce_mode?: "appointments" | "orders" | string | null;
  online_branch_id?: string | null;
};

type Mode = "shop" | "book";

function isServiceProduct(p: Product) {
  return p.product_kind === "service" || p.product_kind === "combo";
}

function productCategory(p: Product) {
  return p.category_ref?.name || p.category || "Uncategorized";
}

function formatPrice(price?: string | number | null) {
  return formatDecimal(price);
}

export default function MarketStoreScreen() {
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const route = useRoute();
  const { id } = (route.params || {}) as { id: string };
  const toast = useToast();
  const { addItem, storeCount } = useCart();
  const [filters, setFilters] = useState<ListingFilterState>(emptyListingFilters());
  const [mode, setMode] = useState<Mode>("shop");
  const [modeInitialized, setModeInitialized] = useState(false);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const session = await getSession();
      if (!session || !isConsumerSession(session)) {
        replacePath(navigation, "/login");
        return;
      }
      if (!cancelled) setAuthReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [navigation]);

  const catalogQuery = useQuery({
    queryKey: marketplaceKeys.catalog(id),
    queryFn: async () => {
      const res = await api<{
        data: {
          business: StoreBiz;
          products: Product[];
          staff?: StaffMember[];
          branch_id?: string;
        };
      }>(`/marketplace/businesses/${id}/catalog`, {}, null);
      const biz = res.data.business;
      return {
        business: biz,
        products: res.data.products || [],
        staff: res.data.staff || [],
        branchId: res.data.branch_id || biz.online_branch_id || null,
      };
    },
    enabled: authReady && !!id,
  });

  const business = catalogQuery.data?.business ?? null;
  const products: Product[] = catalogQuery.data?.products ?? [];
  const staff: StaffMember[] = catalogQuery.data?.staff ?? [];
  const branchId = catalogQuery.data?.branchId ?? null;
  const loading = !authReady || catalogQuery.isLoading;
  const error =
    catalogQuery.error instanceof Error
      ? catalogQuery.error.message
      : catalogQuery.error
        ? "Failed to load store"
        : null;

  const services = useMemo(
    () => products.filter((p: Product) => isServiceProduct(p)),
    [products]
  );
  const goods = useMemo(
    () => products.filter((p: Product) => !isServiceProduct(p)),
    [products]
  );
  const canBook = !!business?.appointments_enabled && services.length > 0;
  const canShop = goods.length > 0 || (!canBook && products.length > 0);
  const showModeTabs = canBook && goods.length > 0;
  const shopProducts = useMemo(() => {
    if (canBook && goods.length > 0) return goods;
    return products;
  }, [canBook, goods, products]);

  // Mode is derived from the store and its catalog. Adjusting during render
  // avoids painting one frame of the wrong tab before the effect corrects it;
  // both branches converge because `modeInitialized` latches.
  const [modeStoreId, setModeStoreId] = useState(id);
  if (id !== modeStoreId) {
    setModeStoreId(id);
    setModeInitialized(false);
  }
  if (catalogQuery.isSuccess && !modeInitialized) {
    if (canBook && !canShop) setMode("book");
    else if (canShop) setMode("shop");
    setModeInitialized(true);
  }

  const categoryOptions = useMemo(() => {
    const set = new Set<string>();
    for (const p of shopProducts) set.add(productCategory(p));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [shopProducts]);

  const filtered = useMemo(
    () =>
      applyListingFilters(shopProducts, filters, {
        searchText: (p) =>
          [p.name, p.sku, p.description, productCategory(p)].filter(Boolean).join(" "),
        category: productCategory,
        price: (p) => Number(p.price || 0),
      }),
    [shopProducts, filters]
  );

  const filtersActive =
    filters.search.trim() !== "" || filters.categories.length > 0;

  function handleQuickAdd(p: Product) {
    if (!business) return;
    addItem(
      {
        id: business.id,
        name: business.name,
        branding: {
          logoUrl: business.logo_url,
          primaryColor: business.primary_color,
          tagline: business.tagline,
        },
      },
      {
        id: p.id,
        name: p.name,
        price: Number(p.price || 0),
        imageUrl: p.image_url,
        category: productCategory(p),
      },
      1
    );
    toast.success(t("marketplace.addedToCart", { name: p.name }));
  }

  function toggleCategory(cat: string) {
    setFilters((prev) => ({
      ...prev,
      categories: prev.categories.includes(cat) ? [] : [cat],
    }));
  }

  const accent = business?.primary_color || undefined;
  const storeCartCount = business ? storeCount(business.id) : 0;
  const palette = brandPaletteFromPrimary(accent);

  if (loading) {
    return (
      <View style={styles.container}>
        <BuyerProductGridSkeleton />
      </View>
    );
  }

  const headerDesc =
    canBook && !canShop
      ? t("pages.catalogBookDesc")
      : business?.tagline || t("marketplace.pickupHint");

  return (
    <View style={styles.container}>
      <Pressable onPress={() => pushPath(navigation, "/app/dashboard")}>
        <Text style={[styles.back, { color: palette.brand }]}>
          {t("marketplace.allStores")}
        </Text>
      </Pressable>

      <View
        style={[
          styles.brandHeader,
          accent ? { borderTopColor: accent, borderTopWidth: 4 } : null,
        ]}
      >
        <View style={styles.header}>
          <View
            style={[
              styles.logo,
              accent ? { borderColor: accent, borderWidth: 2 } : null,
            ]}
          >
            {business?.logo_url ? (
              <Image source={{ uri: business.logo_url }} style={styles.logoImg} />
            ) : (
              <Text style={styles.logoLetter}>
                {(business?.name || "?").slice(0, 1).toUpperCase()}
              </Text>
            )}
          </View>
          <View style={{ flex: 1 }}>
            {business?.industry ? (
              <Text style={styles.industry}>{business.industry}</Text>
            ) : null}
            <Text style={styles.title}>{business?.name || "Store"}</Text>
            <Text style={styles.sub}>{headerDesc}</Text>
          </View>
        </View>
        {business?.marketplace_description ? (
          <Text style={styles.desc}>{business.marketplace_description}</Text>
        ) : null}
        {mode === "shop" && storeCartCount > 0 ? (
          <Pressable
            style={[styles.viewCart, { backgroundColor: palette.brand }]}
            onPress={() => pushPath(navigation, "/app/checkout")}
          >
            <Text style={[styles.viewCartText, { color: palette.brandForeground }]}>
              {t("marketplace.viewCart", { count: storeCartCount })}
            </Text>
          </Pressable>
        ) : null}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {showModeTabs ? (
        <SegmentedTabs
          tabs={[
            { id: "shop" as const, label: t("appointments.modeShop") },
            { id: "book" as const, label: t("appointments.modeBook") },
          ]}
          value={mode}
          onChange={setMode}
        />
      ) : null}

      {mode === "book" && canBook && business ? (
        <BuyerBookFlow
          businessId={business.id}
          branchId={branchId}
          services={services}
          staff={staff}
          accent={accent}
        />
      ) : mode === "shop" && canShop ? (
        <>
          {shopProducts.length > 0 ? (
            <>
              <TextInput
                style={styles.search}
                placeholder={t("marketplace.searchProducts")}
                placeholderTextColor={colors.muted}
                value={filters.search}
                onChangeText={(search) => setFilters((f) => ({ ...f, search }))}
              />
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.chips}
                contentContainerStyle={styles.chipsContent}
              >
                <Pressable
                  style={[
                    styles.chip,
                    filters.categories.length === 0 && {
                      backgroundColor: palette.brand,
                      borderColor: palette.brand,
                    },
                  ]}
                  onPress={() => setFilters((f) => ({ ...f, categories: [] }))}
                >
                  <Text
                    style={[
                      styles.chipText,
                      filters.categories.length === 0 && {
                        color: palette.brandForeground,
                      },
                    ]}
                  >
                    {t("marketplace.allCategories")}
                  </Text>
                </Pressable>
                {categoryOptions.map((cat) => {
                  const on = filters.categories.includes(cat);
                  return (
                    <Pressable
                      key={cat}
                      style={[
                        styles.chip,
                        on && {
                          backgroundColor: palette.brand,
                          borderColor: palette.brand,
                        },
                      ]}
                      onPress={() => toggleCategory(cat)}
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
              {filtersActive ? (
                <Pressable
                  onPress={() => setFilters(emptyListingFilters())}
                  style={styles.clearRow}
                >
                  <Text style={[styles.clearText, { color: palette.brand }]}>
                    {t("marketplace.clearFilters")}
                  </Text>
                </Pressable>
              ) : (
                <Text style={styles.countHint}>
                  {t("marketplace.productsCount", { count: filtered.length })}
                </Text>
              )}
            </>
          ) : null}

          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            numColumns={2}
            style={{ flex: 1 }}
            columnWrapperStyle={styles.gridRow}
            contentContainerStyle={styles.gridContent}
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyTitle}>
                  {shopProducts.length === 0
                    ? t("marketplace.emptyCatalogTitle")
                    : t("common.noResults")}
                </Text>
                <Text style={styles.emptyBody}>
                  {shopProducts.length === 0
                    ? t("marketplace.emptyCatalogBody")
                    : t("marketplace.noFilterMatches")}
                </Text>
                {shopProducts.length === 0 ? (
                  <Pressable
                    style={[styles.emptyBtn, { backgroundColor: palette.brand }]}
                    onPress={() => pushPath(navigation, "/app/dashboard")}
                  >
                    <Text
                      style={[styles.emptyBtnText, { color: palette.brandForeground }]}
                    >
                      {t("marketplace.allStores")}
                    </Text>
                  </Pressable>
                ) : (
                  <Pressable
                    style={[styles.emptyBtn, { backgroundColor: palette.brand }]}
                    onPress={() => setFilters(emptyListingFilters())}
                  >
                    <Text
                      style={[styles.emptyBtnText, { color: palette.brandForeground }]}
                    >
                      {t("marketplace.clearFilters")}
                    </Text>
                  </Pressable>
                )}
              </View>
            }
            renderItem={({ item }) => (
              <Pressable
                style={styles.productCard}
                onPress={() =>
                  go(navigation, "ProductDetail", {
                    storeId: id,
                    productId: item.id,
                  })
                }
              >
                <View style={styles.productImgWrap}>
                  {item.image_url ? (
                    <Image source={{ uri: item.image_url }} style={styles.productImg} />
                  ) : (
                    <View
                      style={[
                        styles.productImg,
                        styles.noImg,
                        accent ? { backgroundColor: `${accent}18` } : null,
                      ]}
                    >
                      <Text style={styles.noImgText}>{t("marketplace.noImage")}</Text>
                    </View>
                  )}
                  <Pressable
                    style={[styles.quickAdd, { backgroundColor: palette.brand }]}
                    hitSlop={6}
                    onPress={() => handleQuickAdd(item)}
                  >
                    <Text style={[styles.quickAddText, { color: palette.brandForeground }]}>
                      +
                    </Text>
                  </Pressable>
                </View>
                <View style={styles.productBody}>
                  <Text style={styles.cat} numberOfLines={1}>
                    {productCategory(item)}
                  </Text>
                  <Text style={styles.productName} numberOfLines={2}>
                    {item.name}
                  </Text>
                  <Text style={styles.productPrice}>Rs {formatPrice(item.price)}</Text>
                </View>
              </Pressable>
            )}
          />
        </>
      ) : (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyTitle}>{t("marketplace.emptyCatalogTitle")}</Text>
          <Text style={styles.emptyBody}>{t("marketplace.emptyCatalogBody")}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgPrimary, padding: 16 },
  back: { fontWeight: "700", marginBottom: 8 },
  brandHeader: {
    backgroundColor: colors.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 12,
    gap: 8,
  },
  header: { flexDirection: "row", gap: 12, alignItems: "center" },
  logo: {
    width: 64,
    height: 64,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  logoImg: { width: "100%", height: "100%" },
  logoLetter: { fontSize: 24, fontWeight: "800", color: colors.heading },
  industry: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: colors.muted,
  },
  title: { fontSize: 22, fontWeight: "800", color: colors.heading },
  sub: { color: colors.body, marginTop: 2 },
  desc: { color: colors.body, fontSize: 13, lineHeight: 18 },
  viewCart: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  viewCartText: { fontWeight: "700", fontSize: 15 },
  error: { color: colors.danger, marginBottom: 8 },
  search: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
    color: colors.heading,
    fontSize: 15,
  },
  chips: { maxHeight: 44, marginBottom: 6 },
  chipsContent: { paddingEnd: 8, alignItems: "center" },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
    marginRight: 8,
    backgroundColor: colors.card,
  },
  chipText: { fontSize: 12, fontWeight: "700", color: colors.heading },
  clearRow: { marginBottom: 8 },
  clearText: { fontSize: 13, fontWeight: "700" },
  countHint: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.muted,
    marginBottom: 8,
  },
  gridContent: { paddingBottom: 28, flexGrow: 1 },
  gridRow: { gap: 10 },
  productCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
    marginBottom: 10,
  },
  productImgWrap: { position: "relative" },
  productImg: { width: "100%", aspectRatio: 1, backgroundColor: colors.bgSecondary },
  noImg: {
    alignItems: "center",
    justifyContent: "center",
  },
  noImgText: { color: colors.muted, fontSize: 12, fontWeight: "600" },
  quickAdd: {
    position: "absolute",
    end: 8,
    bottom: 8,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0f172a",
    shadowOpacity: 0.18,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  quickAddText: { fontSize: 22, fontWeight: "700", lineHeight: 24 },
  productBody: { padding: 10, gap: 3 },
  cat: {
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
    color: colors.muted,
    letterSpacing: 0.5,
  },
  productName: {
    fontWeight: "700",
    color: colors.heading,
    fontSize: 14,
    lineHeight: 18,
    minHeight: 36,
  },
  productDesc: { marginTop: 6, fontSize: 13, color: colors.body, lineHeight: 18 },
  productPrice: { marginTop: 4, fontWeight: "800", color: colors.heading, fontSize: 16 },
  emptyWrap: {
    paddingVertical: 40,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: colors.heading,
    textAlign: "center",
  },
  emptyBody: {
    marginTop: 8,
    fontSize: 14,
    color: colors.body,
    textAlign: "center",
    lineHeight: 20,
  },
  emptyBtn: {
    marginTop: 16,
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  emptyBtnText: { fontWeight: "700", fontSize: 14 },
  modalBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(15,23,42,0.45)",
  },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 28,
    paddingTop: 8,
    maxHeight: "92%",
  },
  sheetHandle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: 10,
  },
  sheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 12,
  },
  sheetTitle: { flex: 1, fontSize: 20, fontWeight: "800", color: colors.heading },
  detailImg: {
    width: "100%",
    height: 220,
    borderRadius: 16,
    marginBottom: 12,
  },
  detailDesc: { marginTop: 10, color: colors.body, lineHeight: 21, fontSize: 14 },
  qtyBlock: {
    marginTop: 18,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  qtyLabel: {
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    color: colors.muted,
  },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    overflow: "hidden",
  },
  stepBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bgSecondary || colors.bgPrimary,
  },
  stepBtnDisabled: { opacity: 0.4 },
  stepBtnText: { fontSize: 20, fontWeight: "700", color: colors.heading },
  qtyValue: {
    minWidth: 40,
    textAlign: "center",
    fontSize: 16,
    fontWeight: "800",
    color: colors.heading,
  },
  addBtn: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 12,
  },
  addText: { fontWeight: "800", fontSize: 16 },
});
