import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { colors, getSession, isConsumerSession } from "../lib/api";
import { useBrandPalette } from "../lib/BrandThemeContext";
import BuyerAr from "../components/BuyerAr";
import { useNavigation, useRoute, useFocusEffect } from "@react-navigation/native";
import type { NavigationProp, ParamListBase } from "@react-navigation/native";
import { replacePath, pushPath } from "../lib/nav";

/** Shared `/accounting` — buyer khata; staff accounting lives on web/desktop for now. */
export default function AccountingScreen() {
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const palette = useBrandPalette();
  const [ready, setReady] = useState(false);
  const [buyer, setBuyer] = useState(false);

  useEffect(() => {
    (async () => {
      const s = await getSession();
      if (!s) {
        replacePath(navigation, "/landing");
        return;
      }
      if (isConsumerSession(s)) {
        setBuyer(true);
        setReady(true);
        return;
      }
      replacePath(navigation, "/app/dashboard");
    })();
  }, []);

  if (!ready) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={palette.brand} />
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
