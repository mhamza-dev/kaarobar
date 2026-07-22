import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { colors, getSession, isConsumerSession } from "../../lib/api";
import BuyerAr from "../../components/BuyerAr";

/** Shared `/accounting` — buyer khata; staff accounting lives on web/desktop for now. */
export default function AccountingScreen() {
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
      router.replace("/app/dashboard");
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
    return <BuyerAr />;
  }

  return (
    <View style={styles.center}>
      <Text style={styles.hint}>Accounting is available on web and desktop.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bgPrimary,
    padding: 24,
  },
  hint: { color: colors.body, textAlign: "center" },
});
