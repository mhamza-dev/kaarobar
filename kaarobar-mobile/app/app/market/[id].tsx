import { useEffect, useMemo, useState } from "react";
import { Link, router, useLocalSearchParams } from "expo-router";
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
import { api, colors, getSession, isConsumerSession } from "../../../lib/api";
import { useCart } from "../../../lib/cart";
import { useToast } from "../../../components/Toast";
import {
  applyListingFilters,
  emptyListingFilters,
  type ListingFilterState,
} from "../../../lib/listingFilters";

type Product = {
  id: string;
  name: string;
  sku?: string;
  price?: string | null;
  image_url?: string | null;
  description?: string | null;
  category?: string | null;
  category_ref?: { id: string; name: string } | null;
};

type StoreBiz = {
  id: string;
  name: string;
  tagline?: string | null;
  logo_url?: string | null;
  primary_color?: string | null;
  marketplace_description?: string | null;
  industry?: string | null;
};

function productCategory(p: Product) {
  return p.category_ref?.name || p.category || "Uncategorized";
}

export default function MarketStoreScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const toast = useToast();
  const { addItem, storeCount } = useCart();
  const [business, setBusiness] = useState<StoreBiz | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<ListingFilterState>(emptyListingFilters());

  useEffect(() => {
    (async () => {
      const session = await getSession();
      if (!session || !isConsumerSession(session)) {
        router.replace("/login");
        return;
      }
      try {
        const res = await api<{
          data: { business: StoreBiz; products: Product[] };
        }>(`/marketplace/businesses/${id}/catalog`, {}, null);
        setBusiness(res.data.business);
        setProducts(res.data.products || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load store");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const categoryOptions = useMemo(() => {
    const set = new Set<string>();
    for (const p of products) set.add(productCategory(p));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [products]);

  const filtered = useMemo(
    () =>
      applyListingFilters(products, filters, {
        searchText: (p) =>
          [p.name, p.sku, p.description, productCategory(p)].filter(Boolean).join(" "),
        category: productCategory,
        price: (p) => Number(p.price || 0),
      }),
    [products, filters]
  );

  function handleAdd(p: Product) {
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
      }
    );
    toast.success(`Added ${p.name}`);
  }

  function toggleCategory(cat: string) {
    setFilters((prev) => ({
      ...prev,
      categories: prev.categories.includes(cat)
        ? prev.categories.filter((c) => c !== cat)
        : [...prev.categories, cat],
    }));
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  }

  const accent = business?.primary_color || undefined;
  const storeCartCount = business ? storeCount(business.id) : 0;

  return (
    <View style={styles.container}>
      <Link href="/app/dashboard" asChild>
        <Pressable>
          <Text style={styles.back}>← All stores</Text>
        </Pressable>
      </Link>

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
            <Text style={styles.sub}>
              {business?.tagline || "Pickup · add to cart"}
            </Text>
          </View>
        </View>
        {business?.marketplace_description ? (
          <Text style={styles.desc}>{business.marketplace_description}</Text>
        ) : null}
        {storeCartCount > 0 ? (
          <Link href="/app/checkout" asChild>
            <Pressable style={styles.viewCart}>
              <Text style={styles.viewCartText}>View cart ({storeCartCount})</Text>
            </Pressable>
          </Link>
        ) : null}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TextInput
        style={styles.search}
        placeholder="Search products…"
        placeholderTextColor={colors.muted}
        value={filters.search}
        onChangeText={(search) => setFilters((f) => ({ ...f, search }))}
      />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips}>
        {categoryOptions.map((cat) => {
          const on = filters.categories.includes(cat);
          return (
            <Pressable
              key={cat}
              style={[styles.chip, on && styles.chipOn]}
              onPress={() => toggleCategory(cat)}
            >
              <Text style={[styles.chipText, on && styles.chipTextOn]}>{cat}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <View style={styles.priceRow}>
        <TextInput
          style={[styles.search, styles.priceInput]}
          placeholder="Min"
          placeholderTextColor={colors.muted}
          keyboardType="decimal-pad"
          value={filters.priceMin}
          onChangeText={(priceMin) => setFilters((f) => ({ ...f, priceMin }))}
        />
        <TextInput
          style={[styles.search, styles.priceInput]}
          placeholder="Max"
          placeholderTextColor={colors.muted}
          keyboardType="decimal-pad"
          value={filters.priceMax}
          onChangeText={(priceMax) => setFilters((f) => ({ ...f, priceMax }))}
        />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        style={{ flex: 1 }}
        contentContainerStyle={{ gap: 10, paddingBottom: 24 }}
        ListEmptyComponent={<Text style={styles.empty}>No products match.</Text>}
        renderItem={({ item }) => (
          <View style={styles.product}>
            {item.image_url ? (
              <Image source={{ uri: item.image_url }} style={styles.productImg} />
            ) : (
              <View style={[styles.productImg, styles.noImg]}>
                <Text style={styles.noImgText}>—</Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.cat}>{productCategory(item)}</Text>
              <Text style={styles.productName}>{item.name}</Text>
              {item.description ? (
                <Text style={styles.productDesc} numberOfLines={2}>
                  {item.description}
                </Text>
              ) : null}
              <Text style={styles.productPrice}>Rs {item.price || "0.00"}</Text>
            </View>
            <Pressable style={styles.addBtn} onPress={() => handleAdd(item)}>
              <Text style={styles.addText}>Add</Text>
            </Pressable>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bgPrimary,
  },
  container: { flex: 1, backgroundColor: colors.bgPrimary, padding: 16 },
  back: { color: colors.brand, fontWeight: "700", marginBottom: 8 },
  brandHeader: {
    backgroundColor: colors.card,
    borderRadius: 14,
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
    borderRadius: 12,
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
  desc: { color: colors.body, fontSize: 13 },
  viewCart: {
    backgroundColor: colors.brand,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  viewCartText: { color: colors.white, fontWeight: "700" },
  error: { color: colors.danger, marginBottom: 8 },
  search: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 8,
    color: colors.heading,
  },
  chips: { maxHeight: 40, marginBottom: 8 },
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
  priceRow: { flexDirection: "row", gap: 8 },
  priceInput: { flex: 1 },
  empty: { color: colors.body, marginTop: 12 },
  product: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  productImg: { width: 56, height: 56, borderRadius: 8 },
  noImg: {
    backgroundColor: colors.bgSecondary || colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  noImgText: { color: colors.muted },
  cat: {
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
    color: colors.muted,
    letterSpacing: 0.5,
  },
  productName: { fontWeight: "700", color: colors.heading, marginTop: 2 },
  productDesc: { marginTop: 2, fontSize: 12, color: colors.body },
  productPrice: { marginTop: 4, fontWeight: "800", color: colors.heading },
  addBtn: {
    backgroundColor: colors.brand,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  addText: { color: colors.white, fontWeight: "700", fontSize: 13 },
});
