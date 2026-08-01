import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { NavigationProp, ParamListBase } from "@react-navigation/native";
import { api, colors, getSession, isConsumerSession } from "../lib/api";
import { useCart } from "../lib/cart";
import { brandPaletteFromPrimary } from "../lib/brandTheme";
import { t } from "../lib/i18n";
import { pushPath, replacePath } from "../lib/nav";
import { useToast } from "../components/Toast";
import {
  BuyerCard,
  BuyerEmptyPanel,
  formatMarketplacePrice,
  marketplaceProductCategory,
} from "../components/BuyerLayout";
import { BuyerOrderDetailSkeleton } from "../components/BuyerSkeletons";

type Product = {
  id: string;
  name: string;
  sku?: string;
  price?: string | null;
  image_url?: string | null;
  description?: string | null;
  category?: string | null;
  category_ref?: { id: string; name: string; slug?: string } | null;
  product_kind?: string | null;
  duration_minutes?: number | null;
};

type StoreBiz = {
  id: string;
  name: string;
  tagline?: string | null;
  logo_url?: string | null;
  primary_color?: string | null;
  marketplace_slug?: string | null;
  industry?: string | null;
};

/** Product detail under a marketplace store. */
export default function ProductDetailScreen() {
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const route = useRoute();
  const params = (route.params || {}) as {
    storeId?: string;
    productId?: string;
    id?: string;
  };
  const storeKey = params.storeId || params.id || "";
  const productId = params.productId || "";
  const toast = useToast();
  const { addItem, storeCount } = useCart();

  const [business, setBusiness] = useState<StoreBiz | null>(null);
  const [product, setProduct] = useState<Product | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [qty, setQty] = useState(1);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (!storeKey || !productId) {
      setError(t("marketplace.productNotFound"));
      setLoading(false);
      return;
    }
    setLoading(true);
    void api<{
      data: { business: StoreBiz; products: Product[] };
    }>(`/marketplace/businesses/${storeKey}/catalog`, {}, null)
      .then((res) => {
        setBusiness(res.data.business);
        const found = (res.data.products || []).find((p) => p.id === productId) || null;
        setProduct(found);
        setError(found ? null : t("marketplace.productNotFound"));
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : t("common.loadFailed"))
      )
      .finally(() => setLoading(false));
  }, [storeKey, productId]);

  async function requireSignIn(): Promise<boolean> {
    const session = await getSession();
    if (!session || !isConsumerSession(session)) {
      replacePath(navigation, "/login");
      return false;
    }
    return true;
  }

  async function handleAdd() {
    if (!business || !product) return;
    if (!(await requireSignIn())) return;
    setAdding(true);
    try {
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
          id: product.id,
          name: product.name,
          price: Number(product.price || 0),
          imageUrl: product.image_url,
          category: marketplaceProductCategory(product),
        },
        qty
      );
      toast.success(t("marketplace.addedToCart", { name: product.name }));
    } finally {
      setAdding(false);
    }
  }

  const accent = business?.primary_color || undefined;
  const palette = useMemo(() => brandPaletteFromPrimary(accent), [accent]);
  const storeHref = `/app/market/${business?.marketplace_slug || business?.id || storeKey}`;
  const cartCount = business ? storeCount(business.id) : 0;
  const lineTotal = product ? Number(product.price || 0) * qty : 0;

  if (loading) {
    return (
      <View style={styles.container}>
        <BuyerOrderDetailSkeleton />
      </View>
    );
  }

  if (error && !product) {
    return (
      <View style={styles.container}>
        <Pressable onPress={() => pushPath(navigation, "/app/products")}>
          <Text style={[styles.back, { color: palette.brand }]}>
            {t("marketplace.backToProducts")}
          </Text>
        </Pressable>
        <BuyerEmptyPanel
          title={t("marketplace.productNotFound")}
          body={t("marketplace.productNotFoundBody")}
          actionLabel={t("marketplace.browseProducts")}
          onAction={() => pushPath(navigation, "/app/products")}
        />
      </View>
    );
  }

  if (!product || !business) return null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.topRow}>
        <Pressable onPress={() => pushPath(navigation, storeHref)}>
          <Text style={[styles.back, { color: palette.brand }]}>
            ← {business.name || t("marketplace.backToStore")}
          </Text>
        </Pressable>
        {cartCount > 0 ? (
          <Pressable
            style={[styles.cartChip, { borderColor: palette.brand }]}
            onPress={() => pushPath(navigation, "/app/checkout")}
          >
            <Text style={[styles.cartChipText, { color: palette.brand }]}>
              {t("marketplace.viewCart", { count: cartCount })}
            </Text>
          </Pressable>
        ) : null}
      </View>

      <BuyerCard accent={accent}>
        {product.image_url ? (
          <Image source={{ uri: product.image_url }} style={styles.heroImg} />
        ) : (
          <View
            style={[
              styles.heroImg,
              styles.noImg,
              accent ? { backgroundColor: `${accent}18` } : null,
            ]}
          >
            <Text style={styles.noImgText}>{t("marketplace.noImage")}</Text>
          </View>
        )}
        <View style={styles.body}>
          <Text style={styles.cat}>{marketplaceProductCategory(product)}</Text>
          <Text style={styles.title}>{product.name}</Text>
          <Pressable onPress={() => pushPath(navigation, storeHref)}>
            <Text style={[styles.storeLink, { color: palette.brand }]}>
              {business.name}
            </Text>
          </Pressable>
          {business.tagline ? (
            <Text style={styles.tagline}>{business.tagline}</Text>
          ) : null}
          <Text style={styles.price}>Rs {formatMarketplacePrice(product.price)}</Text>

          {product.product_kind === "service" || product.product_kind === "combo" ? (
            <Text style={[styles.badge, { backgroundColor: palette.brandSoft, color: palette.brand }]}>
              {product.duration_minutes
                ? t("appointments.minutes", { count: product.duration_minutes })
                : t("appointments.service")}
            </Text>
          ) : null}

          {product.description ? (
            <Text style={styles.desc}>{product.description}</Text>
          ) : (
            <Text style={styles.muted}>{t("marketplace.noDescription")}</Text>
          )}
          {product.sku ? <Text style={styles.muted}>SKU · {product.sku}</Text> : null}

          <View style={styles.qtyBlock}>
            <Text style={styles.qtyLabel}>{t("marketplace.quantity")}</Text>
            <View style={styles.stepper}>
              <Pressable
                style={[styles.stepBtn, qty <= 1 && styles.stepDisabled]}
                disabled={qty <= 1}
                onPress={() => setQty((q) => Math.max(1, q - 1))}
              >
                <Text style={styles.stepText}>−</Text>
              </Pressable>
              <Text style={styles.qtyValue}>{qty}</Text>
              <Pressable
                style={styles.stepBtn}
                onPress={() => setQty((q) => Math.min(99, q + 1))}
              >
                <Text style={styles.stepText}>+</Text>
              </Pressable>
            </View>
            <View style={{ marginStart: "auto" }}>
              <Text style={styles.qtyLabel}>{t("marketplace.lineTotal")}</Text>
              <Text style={styles.priceSm}>Rs {formatMarketplacePrice(lineTotal)}</Text>
            </View>
          </View>

          <Pressable
            style={[
              styles.addBtn,
              { backgroundColor: palette.brand, opacity: adding ? 0.6 : 1 },
            ]}
            disabled={adding}
            onPress={() => void handleAdd()}
          >
            {adding ? (
              <ActivityIndicator color={palette.brandForeground} />
            ) : (
              <Text style={[styles.addText, { color: palette.brandForeground }]}>
                {qty > 1
                  ? t("marketplace.addQtyToCart", { count: qty })
                  : t("marketplace.addToCart")}
              </Text>
            )}
          </Pressable>
        </View>
      </BuyerCard>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgPrimary, padding: 16 },
  content: { paddingBottom: 40 },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    gap: 8,
  },
  back: { fontWeight: "700", fontSize: 14 },
  cartChip: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  cartChipText: { fontWeight: "700", fontSize: 12 },
  heroImg: { width: "100%", aspectRatio: 1, backgroundColor: colors.bgSecondary },
  noImg: { alignItems: "center", justifyContent: "center" },
  noImgText: { color: colors.muted, fontWeight: "600" },
  body: { padding: 16, gap: 8 },
  cat: {
    fontSize: 10,
    fontWeight: "800",
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  title: { fontSize: 24, fontWeight: "800", color: colors.heading, letterSpacing: -0.3 },
  storeLink: { fontWeight: "700", fontSize: 14 },
  tagline: { color: colors.body, fontSize: 13 },
  price: { fontSize: 28, fontWeight: "800", color: colors.heading, marginTop: 4 },
  priceSm: { fontSize: 17, fontWeight: "800", color: colors.heading },
  badge: {
    alignSelf: "flex-start",
    overflow: "hidden",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    fontSize: 12,
    fontWeight: "700",
  },
  desc: { color: colors.body, lineHeight: 20, fontSize: 14 },
  muted: { color: colors.muted, fontSize: 13 },
  qtyBlock: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 12,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  qtyLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: colors.muted,
    textTransform: "uppercase",
  },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: colors.radiusLg,
    overflow: "hidden",
  },
  stepBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.card,
  },
  stepDisabled: { opacity: 0.4 },
  stepText: { fontSize: 18, fontWeight: "700", color: colors.heading },
  qtyValue: { minWidth: 36, textAlign: "center", fontWeight: "800", fontSize: 16 },
  addBtn: {
    marginTop: 8,
    borderRadius: colors.radiusLg,
    paddingVertical: 14,
    alignItems: "center",
  },
  addText: { fontWeight: "700", fontSize: 16 },
});
