import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { colors } from "../lib/api";

export default function RootLayout() {
  return (
    <>
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
        <Stack.Screen name="landing" options={{ title: "Kaarobar" }} />
        <Stack.Screen name="login" options={{ title: "Sign in" }} />
        <Stack.Screen name="signup" options={{ title: "Create account" }} />
        <Stack.Screen name="dashboard" options={{ title: "Dashboard" }} />
        <Stack.Screen name="pos" options={{ title: "POS" }} />
        <Stack.Screen name="returns" options={{ title: "Returns" }} />
        <Stack.Screen name="inventory" options={{ title: "Inventory" }} />
        <Stack.Screen name="ess" options={{ title: "Staff tools" }} />
      </Stack>
    </>
  );
}
