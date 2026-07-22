import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { colors } from "../lib/api";
import { ToastProvider } from "../components/Toast";
import { t } from "../lib/i18n";

export default function RootLayout() {
  return (
    <ToastProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.sidebar },
          headerTintColor: colors.white,
          headerTitleStyle: { fontWeight: "700" },
          contentStyle: { backgroundColor: colors.bgPrimary },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="landing" options={{ title: t("mobile.landingTitle") }} />
        <Stack.Screen name="login" options={{ title: t("auth.signInTitle") }} />
        <Stack.Screen name="signup" options={{ title: t("auth.signUpTitle") }} />
        <Stack.Screen name="app/dashboard" options={{ title: t("nav.dashboard") }} />
        <Stack.Screen name="app/sales" options={{ title: "Orders" }} />
        <Stack.Screen name="app/pos" options={{ title: t("nav.pos") }} />
        <Stack.Screen name="app/customers" options={{ title: t("nav.customers") }} />
        <Stack.Screen name="app/accounting" options={{ title: "Balance" }} />
        <Stack.Screen name="app/marketing" options={{ title: t("nav.marketing") }} />
        <Stack.Screen name="app/returns" options={{ title: t("nav.returns") }} />
        <Stack.Screen name="app/inventory" options={{ title: t("nav.inventory") }} />
        <Stack.Screen name="app/ess" options={{ title: t("nav.ess") }} />
        <Stack.Screen name="app/leave" options={{ title: "Leave approvals" }} />
        <Stack.Screen name="app/notifications" options={{ title: t("nav.notifications") }} />
        <Stack.Screen name="app/profile" options={{ title: t("nav.profile") }} />
        <Stack.Screen name="app/market/index" options={{ title: "Marketplace" }} />
        <Stack.Screen name="app/market/[id]" options={{ title: "Store" }} />
      </Stack>
    </ToastProvider>
  );
}
