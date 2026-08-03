import React, { useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { colors, getSession } from "../lib/api";
import { loadLocale, t } from "../lib/i18n";
import KaarobarLogo from "../components/KaarobarLogo";
import LandingScreen from "../screens/LandingScreen";
import LoginScreen from "../screens/LoginScreen";
import SignupScreen from "../screens/SignupScreen";
import MainTabs from "./MainTabs";

const Stack = createNativeStackNavigator();

export default function RootNavigator() {
  const [booting, setBooting] = useState(true);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    (async () => {
      await loadLocale();
      const session = await getSession();
      setAuthed(!!session?.access_token && session.actor !== "consumer");
      setBooting(false);
    })();
  }, []);

  if (booting) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          backgroundColor: colors.bgPrimary,
        }}
      >
        <KaarobarLogo size={56} />
        <ActivityIndicator color={colors.brand} />
        <Text style={{ color: colors.body, fontSize: 14, fontWeight: "500" }}>
          {t("common.workspaceLoading")}
        </Text>
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName={authed ? "Main" : "Landing"}
        screenOptions={{
          headerStyle: { backgroundColor: colors.glass },
          headerTintColor: colors.heading,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.bgPrimary },
        }}
      >
        <Stack.Screen
          name="Landing"
          component={LandingScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Login"
          component={LoginScreen}
          options={{ title: "Sign in" }}
        />
        <Stack.Screen
          name="Signup"
          component={SignupScreen}
          options={{ title: "Sign up" }}
        />
        <Stack.Screen
          name="Main"
          component={MainTabs}
          options={{ headerShown: false }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
