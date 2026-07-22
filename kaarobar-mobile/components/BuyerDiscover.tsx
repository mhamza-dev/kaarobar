import { useCallback, useState } from "react";
import { Link, useFocusEffect } from "expo-router";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { api, colors } from "../lib/api";
import BuyerNav from "./BuyerNav";

type Biz = {
  id: string;
  name: string;
  industry?: string | null;
  marketplace_slug?: string | null;
};

/** Buyer home on `/dashboard` — discover marketplace stores. */
export default function BuyerDiscover() {
  const [q, setQ] = useState("");
  const [businesses, setBusinesses] = useState<Biz[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        setLoading(true);
        try {
          const res = await api<{ data: Biz[] }>(
            `/marketplace/businesses${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ""}`,
            {},
            null
          );
          if (!cancelled) {
            setBusinesses(res.data || []);
            setError(null);
          }
        } catch (err) {
          if (!cancelled) {
            setError(err instanceof Error ? err.message : "Failed to load");
          }
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [q])
  );

  return (
    <View style={styles.container}>
      <BuyerNav />
      <Text style={styles.title}>Discover stores</Text>
      <Text style={styles.hint}>Browse Kaarobar businesses and place pickup orders.</Text>
      <TextInput
        style={styles.search}
        placeholder="Search by name or industry"
        placeholderTextColor={colors.muted}
        value={q}
        onChangeText={setQ}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loading ? (
        <ActivityIndicator color={colors.brand} style={{ marginTop: 24 }} />
      ) : (
        <FlatList
          data={businesses}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 40, gap: 10 }}
          ListEmptyComponent={
            <Text style={styles.empty}>No marketplace stores listed yet.</Text>
          }
          renderItem={({ item }) => (
            <Link href={`/app/market/${item.marketplace_slug || item.id}`} asChild>
              <Pressable style={styles.card}>
                <Text style={styles.cardTitle}>{item.name}</Text>
                <Text style={styles.cardSub}>{item.industry || "store"}</Text>
              </Pressable>
            </Link>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgPrimary, padding: 16 },
  title: { fontSize: 22, fontWeight: "800", color: colors.heading },
  hint: { color: colors.body, marginTop: 4, marginBottom: 12 },
  search: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
    color: colors.heading,
  },
  error: { color: colors.danger, marginBottom: 8 },
  empty: { color: colors.body, marginTop: 16 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
  },
  cardTitle: { fontSize: 17, fontWeight: "700", color: colors.heading },
  cardSub: { marginTop: 4, color: colors.body, textTransform: "capitalize" },
});
