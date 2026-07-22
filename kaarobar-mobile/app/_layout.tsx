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
        <Stack.Screen name="dashboard" options={{ title: t("nav.dashboard") }} />
        <Stack.Screen name="pos" options={{ title: t("nav.pos") }} />
        <Stack.Screen name="customers" options={{ title: t("nav.customers") }} />
        <Stack.Screen name="marketing" options={{ title: t("nav.marketing") }} />
        <Stack.Screen name="returns" options={{ title: t("nav.returns") }} />
        <Stack.Screen name="inventory" options={{ title: t("nav.inventory") }} />
        <Stack.Screen name="ess" options={{ title: t("nav.ess") }} />
        <Stack.Screen name="leave" options={{ title: "Leave approvals" }} />
        <Stack.Screen name="notifications" options={{ title: t("nav.notifications") }} />
        <Stack.Screen name="profile" options={{ title: t("nav.profile") }} />
      </Stack>
    </ToastProvider>
  );
}
