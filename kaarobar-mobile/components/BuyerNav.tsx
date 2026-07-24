import { Link, usePathname, router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, clearSession } from "../lib/api";
import { useCartOptional } from "../lib/cart";
import { useBrandPalette } from "../lib/BrandThemeContext";

const LINKS = [
  { href: "/app/dashboard", label: "Discover" },
  { href: "/app/sales", label: "Orders" },
  { href: "/app/customers", label: "Loyalty" },
  { href: "/app/accounting", label: "Balance" },
  { href: "/app/notifications", label: "Alerts" },
] as const;

/** Bottom tab bar for consumer marketplace. */
export default function BuyerNav() {
  const pathname = usePathname();
  const cart = useCartOptional();
  const brand = useBrandPalette();
  const count = cart?.itemCount ?? 0;

  async function signOut() {
    await clearSession();
    router.replace("/login");
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.topRow}>
        <Text style={styles.eyebrow}>Marketplace</Text>
        <Link href="/app/checkout" asChild>
          <Pressable style={styles.cartBtn}>
            <Text style={styles.cartLabel}>Cart</Text>
            {count > 0 ? (
              <View style={[styles.badge, { backgroundColor: brand.brand }]}>
                <Text style={[styles.badgeText, { color: brand.brandForeground }]}>
                  {count > 99 ? "99+" : count}
                </Text>
              </View>
            ) : null}
          </Pressable>
        </Link>
      </View>
      <View style={styles.row}>
        {LINKS.map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== "/app/dashboard" && pathname.startsWith(item.href));
          return (
            <Link key={item.href} href={item.href} asChild>
              <Pressable
                style={[
                  styles.tab,
                  active && { backgroundColor: brand.brand },
                ]}
              >
                <Text
                  style={[
                    styles.tabText,
                    active && { color: brand.brandForeground },
                  ]}
                  numberOfLines={1}
                >
                  {item.label}
                </Text>
              </Pressable>
            </Link>
          );
        })}
      </View>
      <Pressable onPress={signOut} style={styles.signOutBtn}>
        <Text style={[styles.signOut, { color: brand.brand }]}>Sign out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 14,
    gap: 8,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: colors.muted,
  },
  cartBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  cartLabel: { fontWeight: "800", fontSize: 13, color: colors.heading },
  badge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { fontSize: 10, fontWeight: "800" },
  row: {
    flexDirection: "row",
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 4,
    gap: 2,
  },
  tab: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 4,
    alignItems: "center",
  },
  tabText: { color: colors.body, fontWeight: "700", fontSize: 11 },
  signOutBtn: { alignSelf: "flex-end" },
  signOut: { fontWeight: "700", fontSize: 13 },
});
