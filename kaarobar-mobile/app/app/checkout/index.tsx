import { useEffect } from "react";
import { Link, router } from "expo-router";
import { FlatList, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "../../../lib/api";
import { useCart, type CartStore } from "../../../lib/cart";
import BuyerNav from "../../../components/BuyerNav";

function StoreSection({
  store,
  onSetQty,
  onRemove,
  onClear,
}: {
  store: CartStore;
  onSetQty: (businessId: string, productId: string, quantity: number) => void;
  onRemove: (businessId: string, productId: string) => void;
  onClear: (businessId: string) => void;
}) {
  const storeTotal = store.lines.reduce((s, l) => s + l.quantity * l.price, 0);
  const accent = store.branding?.primaryColor;
  return (
    <View
      style={[
        styles.storeCard,
        accent ? { borderTopColor: accent, borderTopWidth: 3 } : null,
      ]}
    >
      <View style={styles.storeHead}>
        <View style={{ flex: 1 }}>
          <Text style={styles.storeName}>{store.businessName}</Text>
          <Text style={styles.storeSub}>Rs {storeTotal.toFixed(2)}</Text>
        </View>
        <Link href={`/app/market/${store.businessId}`} asChild>
          <Pressable>
            <Text style={styles.linkInline}>Shop</Text>
          </Pressable>
        </Link>
        <Pressable onPress={() => onClear(store.businessId)}>
          <Text style={styles.remove}>Clear</Text>
        </Pressable>
      </View>
      {store.lines.map((line) => (
        <View key={line.productId} style={styles.row}>
          {line.imageUrl ? (
            <Image source={{ uri: line.imageUrl }} style={styles.img} />
          ) : (
            <View style={[styles.img, styles.noImg]} />
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{line.name}</Text>
            <Text style={styles.price}>Rs {line.price.toFixed(2)}</Text>
            <View style={styles.qtyRow}>
              <Pressable
                style={styles.qtyBtn}
                onPress={() =>
                  onSetQty(store.businessId, line.productId, line.quantity - 1)
                }
              >
                <Text style={styles.qtyBtnText}>−</Text>
              </Pressable>
              <Text style={styles.qty}>{line.quantity}</Text>
              <Pressable
                style={styles.qtyBtn}
                onPress={() =>
                  onSetQty(store.businessId, line.productId, line.quantity + 1)
                }
              >
                <Text style={styles.qtyBtnText}>+</Text>
              </Pressable>
              <Pressable onPress={() => onRemove(store.businessId, line.productId)}>
                <Text style={styles.remove}>Remove</Text>
              </Pressable>
            </View>
          </View>
          <Text style={styles.lineTotal}>
            Rs {(line.quantity * line.price).toFixed(2)}
          </Text>
        </View>
      ))}
    </View>
  );
}

export default function CheckoutReviewScreen() {
  const { stores, itemCount, subtotal, setQty, removeItem, clearStore } = useCart();

  useEffect(() => {
    if (stores.length === 0) {
      router.replace("/app/dashboard");
    }
  }, [stores.length]);

  if (stores.length === 0) {
    return (
      <View style={styles.container}>
        <BuyerNav />
        <Text style={styles.empty}>Your cart is empty.</Text>
        <Link href="/app/dashboard" asChild>
          <Pressable>
            <Text style={styles.link}>Browse stores</Text>
          </Pressable>
        </Link>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <BuyerNav />
      <Text style={styles.title}>Review cart</Text>
      <Text style={styles.sub}>
        {stores.length === 1 ? stores[0].businessName : `${stores.length} stores`} ·{" "}
        {itemCount} item{itemCount === 1 ? "" : "s"}
      </Text>

      <FlatList
        data={stores}
        keyExtractor={(s) => s.businessId}
        contentContainerStyle={{ gap: 14, paddingBottom: 16 }}
        renderItem={({ item: store }) => (
          <StoreSection
            store={store}
            onSetQty={setQty}
            onRemove={removeItem}
            onClear={clearStore}
          />
        )}
        ListFooterComponent={
          <View style={styles.footer}>
            <Text style={styles.total}>Grand total · Rs {subtotal.toFixed(2)}</Text>
            <Pressable style={styles.cta} onPress={() => router.push("/app/checkout/pay")}>
              <Text style={styles.ctaText}>Continue</Text>
            </Pressable>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgPrimary, padding: 16 },
  empty: { color: colors.body, marginTop: 24 },
  link: { color: colors.brand, fontWeight: "700", marginTop: 8 },
  linkInline: { color: colors.brand, fontWeight: "700" },
  title: { fontSize: 24, fontWeight: "800", color: colors.heading },
  sub: { color: colors.body, marginBottom: 12, marginTop: 4 },
  storeCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    gap: 10,
  },
  storeHead: { flexDirection: "row", alignItems: "center", gap: 12 },
  storeName: { fontWeight: "800", color: colors.heading, fontSize: 16 },
  storeSub: { color: colors.body, fontSize: 12, marginTop: 2 },
  row: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 10,
  },
  img: { width: 48, height: 48, borderRadius: 8 },
  noImg: { backgroundColor: colors.border },
  name: { fontWeight: "700", color: colors.heading },
  price: { color: colors.body, fontSize: 12, marginTop: 2 },
  qtyRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
  qtyBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  qtyBtnText: { fontWeight: "800", color: colors.heading },
  qty: { fontWeight: "800", minWidth: 20, textAlign: "center" },
  remove: { color: colors.danger, fontWeight: "600", fontSize: 12 },
  lineTotal: { fontWeight: "800", color: colors.heading },
  footer: { paddingTop: 8, gap: 10 },
  total: { fontWeight: "800", fontSize: 16, color: colors.heading },
  cta: {
    backgroundColor: colors.brand,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  ctaText: { color: colors.white, fontWeight: "700" },
});
