import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { colors, getSession, isConsumerSession } from "../../lib/api";
import BuyerOrders from "../../components/BuyerOrders";

/** Shared `/sales` — buyer order history; staff use POS for sales. */
export default function SalesScreen() {
  const [ready, setReady] = useState(false);
  const [buyer, setBuyer] = useState(false);

  useEffect(() => {
    (async () => {
      const s = await getSession();
      if (!s) {
        router.replace("/landing");
        return;
      }
      if (isConsumerSession(s)) {
        setBuyer(true);
        setReady(true);
        return;
      }
      router.replace("/app/pos");
    })();
  }, []);

  if (!ready) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  }

  if (buyer) {
    return <BuyerOrders />;
  }

  return (
    <View style={styles.center}>
      <Text style={styles.hint}>Opening POS…</Text>
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
  hint: { color: colors.body },
});
