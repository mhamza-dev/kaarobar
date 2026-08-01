import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "../lib/api";
import { t } from "../lib/i18n";
import {
  BuyerCard,
  formatMarketplacePrice,
  marketplaceProductCategory,
} from "./BuyerLayout";

export type MarketplaceProductCardItem = {
  id: string;
  name: string;
  price?: string | number | null;
  image_url?: string | null;
  category?: string | null;
  category_ref?: { name?: string | null } | null;
  business_id?: string;
  business_slug?: string | null;
  business_name?: string | null;
  primary_color?: string | null;
};

type Props = {
  product: MarketplaceProductCardItem;
  onPress: () => void;
  showStore?: boolean;
  accent?: string | null;
  onQuickAdd?: () => void;
};

/** Large product tile for Products feed and store grids. */
export default function BuyerProductCard({
  product,
  onPress,
  showStore = false,
  accent,
  onQuickAdd,
}: Props) {
  const category = marketplaceProductCategory(product);
  const color = accent || product.primary_color || undefined;

  return (
    <BuyerCard accent={color} style={styles.wrap}>
      <Pressable onPress={onPress} style={styles.press}>
        <View style={styles.imgWrap}>
          {product.image_url ? (
            <Image source={{ uri: product.image_url }} style={styles.img} />
          ) : (
            <View
              style={[
                styles.img,
                styles.noImg,
                color ? { backgroundColor: `${color}18` } : null,
              ]}
            >
              <Text style={styles.noImgText}>{t("marketplace.noImage")}</Text>
            </View>
          )}
          {onQuickAdd ? (
            <Pressable
              style={styles.quickAdd}
              hitSlop={6}
              onPress={(e) => {
                e.stopPropagation?.();
                onQuickAdd();
              }}
            >
              <Text style={styles.quickAddText}>+</Text>
            </Pressable>
          ) : null}
        </View>
        <View style={styles.body}>
          <Text style={styles.cat} numberOfLines={1}>
            {category}
          </Text>
          <Text style={styles.name} numberOfLines={2}>
            {product.name}
          </Text>
          {showStore && product.business_name ? (
            <Text style={styles.store} numberOfLines={1}>
              {product.business_name}
            </Text>
          ) : null}
          <Text style={styles.price}>Rs {formatMarketplacePrice(product.price)}</Text>
        </View>
      </Pressable>
    </BuyerCard>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  press: { flex: 1 },
  imgWrap: { position: "relative", aspectRatio: 4 / 3, backgroundColor: colors.bgSecondary },
  img: { width: "100%", height: "100%" },
  noImg: { alignItems: "center", justifyContent: "center" },
  noImgText: { color: colors.muted, fontSize: 12, fontWeight: "600" },
  quickAdd: {
    position: "absolute",
    end: 10,
    bottom: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  quickAddText: { color: colors.white, fontSize: 22, fontWeight: "700", marginTop: -2 },
  body: { padding: 12, gap: 4, flex: 1 },
  cat: {
    fontSize: 10,
    fontWeight: "800",
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  name: { fontSize: 15, fontWeight: "700", color: colors.heading, lineHeight: 20 },
  store: { fontSize: 12, color: colors.body },
  price: { marginTop: "auto", paddingTop: 6, fontSize: 17, fontWeight: "800", color: colors.heading },
});
