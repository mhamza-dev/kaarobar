import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NavigationProp, ParamListBase } from "@react-navigation/native";
import { pushPath } from "../lib/nav";
import { colors } from "../lib/api";

/** Profile lives under Settings → Profile tab. */
export default function ProfileScreen() {
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  useEffect(() => {
    pushPath(navigation, "/app/settings", { tab: "profile" });
  }, [navigation]);
  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.bgPrimary,
      }}
    >
      <ActivityIndicator color={colors.brand} />
    </View>
  );
}
