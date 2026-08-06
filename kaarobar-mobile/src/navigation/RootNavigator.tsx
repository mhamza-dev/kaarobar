import React, { useEffect } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { colors } from "../lib/api";
import { loadLocale, t } from "../lib/i18n";
import KaarobarLogo from "../components/KaarobarLogo";
import LandingScreen from "../screens/LandingScreen";
import LoginScreen from "../screens/LoginScreen";
import SignupScreen from "../screens/SignupScreen";
import MainTabs from "./MainTabs";
import { useSession } from "../lib/SessionContext"; // <-- new

const Stack = createNativeStackNavigator();

export default function RootNavigator() {
  const { session, loading } = useSession();
  const authed = !!session?.access_token && session?.actor !== "consumer";
  useEffect(() => {
    loadLocale();
  }, []);
  console.log("authed -->", authed);
  console.log("loading -->", loading);
  console.log("session in Navigator -->", session);



  if (!loading) {
    return (
      <NavigationContainer>
        <Stack.Navigator
          key={authed ? 'app-stack' : 'auth-stack'}
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