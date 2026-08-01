import { Pressable, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NavigationProp, ParamListBase } from "@react-navigation/native";
import { pushPath } from "../lib/nav";
import { colors } from "../lib/api";
import { useCartOptional } from "../lib/cart";
import { useBrandPalette } from "../lib/BrandThemeContext";
import { t } from "../lib/i18n";

/**
 * Compact cart chrome for discover/store screens.
 * Primary navigation is React Navigation bottom tabs (≤5).
 */
export default function BuyerNav() {
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const cart = useCartOptional();
  const brand = useBrandPalette();
  const count = cart?.itemCount ?? 0;

  return (
    <View style={styles.wrap}>
      <Text style={styles.eyebrow}>{t("marketplace.eyebrow")}</Text>
      <Pressable
        style={styles.cartBtn}
        onPress={() => pushPath(navigation, "/app/checkout")}
      >
        <Text style={styles.cartLabel}>{t("pos.cart")}</Text>
        {count > 0 ? (
          <View style={[styles.badge, { backgroundColor: brand.brand }]}>
            <Text style={[styles.badgeText, { color: brand.brandForeground }]}>
              {count > 99 ? "99+" : count}
            </Text>
          </View>
        ) : null}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.card,
    marginBottom: 8,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.muted,
    textTransform: "uppercase",
  },
  cartBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: colors.radiusLg,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  cartLabel: { fontWeight: "700", color: colors.heading },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  badgeText: { fontSize: 11, fontWeight: "800" },
});
