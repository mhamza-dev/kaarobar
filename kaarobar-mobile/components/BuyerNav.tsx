import { Link, usePathname } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, clearSession } from "../lib/api";
import { router } from "expo-router";

const LINKS = [
  { href: "/app/dashboard", label: "Discover" },
  { href: "/app/sales", label: "Orders" },
  { href: "/app/customers", label: "Loyalty" },
  { href: "/app/accounting", label: "Balance" },
] as const;

/** Shared buyer chrome — same routes as staff, labels by actor. */
export default function BuyerNav() {
  const pathname = usePathname();

  async function signOut() {
    await clearSession();
    router.replace("/login");
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        {LINKS.map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== "/app/dashboard" && pathname.startsWith(item.href));
          return (
            <Link key={item.href} href={item.href} asChild>
              <Pressable style={[styles.chip, active && styles.chipOn]}>
                <Text style={[styles.chipText, active && styles.chipTextOn]}>
                  {item.label}
                </Text>
              </Pressable>
            </Link>
          );
        })}
      </View>
      <Pressable onPress={signOut}>
        <Text style={styles.signOut}>Sign out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 12,
    gap: 10,
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipOn: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
  },
  chipText: { color: colors.heading, fontWeight: "700", fontSize: 13 },
  chipTextOn: { color: colors.white },
  signOut: { color: colors.brand, fontWeight: "700", alignSelf: "flex-end" },
});
