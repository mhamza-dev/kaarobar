import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { colors } from "../lib/api";
import { useBrandPalette } from "../lib/BrandThemeContext";
import { useNavigation, useRoute, useFocusEffect } from "@react-navigation/native";
import type { NavigationProp, ParamListBase } from "@react-navigation/native";
import { replacePath, pushPath } from "../lib/nav";

/** Legacy `/market` discover → shared `/dashboard` buyer home. */
export default function MarketRedirect() {
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const palette = useBrandPalette();
  useEffect(() => {
    replacePath(navigation, "/app/dashboard");
  }, []);

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bgPrimary }}>
      <ActivityIndicator color={palette.brand} />
    </View>
  );
}
