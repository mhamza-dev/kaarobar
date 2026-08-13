import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { pushPath } from "@/lib/nav";
import { useTheme } from '@/theme';


/** Profile lives under Settings → Profile tab. */
export default function ProfileScreen() {
  const theme = useTheme();
  useEffect(() => {
    pushPath("/app/settings", { tab: "profile" });
  }, []);
  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: theme.bgPrimary,
      }}
    >
      <ActivityIndicator color={theme.brand} />
    </View>
  );
}
