import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { router } from "expo-router";
import { colors } from "../../../lib/api";

/** Legacy `/market` discover → shared `/dashboard` buyer home. */
export default function MarketRedirect() {
  useEffect(() => {
    router.replace("/app/dashboard");
  }, []);

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bgPrimary }}>
      <ActivityIndicator color={colors.brand} />
    </View>
  );
}
