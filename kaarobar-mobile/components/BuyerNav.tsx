import { Link, usePathname, router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, clearSession } from "../lib/api";
import { useCartOptional } from "../lib/cart";

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
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{count > 99 ? "99+" : count}</Text>
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
              <Pressable style={[styles.tab, active && styles.tabOn]}>
                <Text style={[styles.tabText, active && styles.tabTextOn]} numberOfLines={1}>
                  {item.label}
                </Text>
              </Pressable>
            </Link>
          );
        })}
      </View>
      <Pressable onPress={signOut} style={styles.signOutBtn}>
        <Text style={styles.signOut}>Sign out</Text>
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
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { color: colors.white, fontSize: 10, fontWeight: "800" },
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
  tabOn: {
    backgroundColor: colors.brand,
  },
  tabText: { color: colors.body, fontWeight: "700", fontSize: 11 },
  tabTextOn: { color: colors.white },
  signOutBtn: { alignSelf: "flex-end" },
  signOut: { color: colors.brand, fontWeight: "700", fontSize: 13 },
});
