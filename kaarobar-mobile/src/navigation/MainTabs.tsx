import React from "react";
import { Text } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import type { MainTabParamList, SettingsStackParamList } from "./types";
import { colors } from "../lib/api";
import { useBrandPalette } from "../lib/BrandThemeContext";
import { t } from "../lib/i18n";

import PosScreen from "../screens/PosScreen";
import SalesScreen from "../screens/SalesScreen";
import ProductsScreen from "../screens/ProductsScreen";
import CustomersScreen from "../screens/CustomersScreen";
import SettingsScreen from "../screens/SettingsScreen";
import AttendanceScreen from "../screens/AttendanceScreen";
import LeaveScreen from "../screens/LeaveScreen";
import NotificationsScreen from "../screens/NotificationsScreen";
import BusinessesScreen from "../screens/BusinessesScreen";
import BusinessDetailScreen from "../screens/BusinessDetailScreen";
import MarketingScreen from "../screens/MarketingScreen";
import ReturnsScreen from "../screens/ReturnsScreen";
import DashboardScreen from "../screens/DashboardScreen";

const Tab = createBottomTabNavigator<MainTabParamList>();
const SettingsStack = createNativeStackNavigator<SettingsStackParamList>();

function TabLabel({ label, color }: { label: string; color: string }) {
  return (
    <Text style={{ fontSize: 11, fontWeight: "700", color }} numberOfLines={1}>
      {label}
    </Text>
  );
}

function SettingsNavigator() {
  return (
    <SettingsStack.Navigator>
      <SettingsStack.Screen
        name="SettingsHome"
        component={SettingsScreen}
        options={{ title: t("nav.settings") }}
      />
      <SettingsStack.Screen
        name="Attendance"
        component={AttendanceScreen}
        options={{ title: "Attendance" }}
      />
      <SettingsStack.Screen
        name="Workspace"
        component={DashboardScreen}
        options={{ title: "Workspace" }}
      />
      <SettingsStack.Screen
        name="Leave"
        component={LeaveScreen}
        options={{ title: "Leave approvals" }}
      />
      <SettingsStack.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{ title: t("nav.notifications") }}
      />
      <SettingsStack.Screen
        name="Businesses"
        component={BusinessesScreen}
        options={{ title: t("nav.businesses") }}
      />
      <SettingsStack.Screen
        name="BusinessDetail"
        component={BusinessDetailScreen}
        options={{ title: t("pages.businessDetailTitle") }}
      />
      <SettingsStack.Screen
        name="Marketing"
        component={MarketingScreen}
        options={{ title: t("nav.marketing") }}
      />
      <SettingsStack.Screen
        name="Returns"
        component={ReturnsScreen}
        options={{ title: t("nav.returns") }}
      />
    </SettingsStack.Navigator>
  );
}

export default function MainTabs() {
  const palette = useBrandPalette();
  return (
    <Tab.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.glass },
        headerTintColor: colors.heading,
        headerShadowVisible: false,
        tabBarActiveTintColor: palette.brand,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
        },
      }}
    >
      <Tab.Screen
        name="Pos"
        component={PosScreen}
        options={{
          title: t("nav.pos"),
          tabBarLabel: ({ color }) => <TabLabel label={t("nav.pos")} color={color} />,
        }}
      />
      <Tab.Screen
        name="Sales"
        component={SalesScreen}
        options={{
          title: t("nav.sales") || "Sales",
          tabBarLabel: ({ color }) => (
            <TabLabel label={t("nav.sales") || "Sales"} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Products"
        component={ProductsScreen}
        options={{
          title: t("nav.inventory") || "Products",
          tabBarLabel: ({ color }) => <TabLabel label="Products" color={color} />,
        }}
      />
      <Tab.Screen
        name="Customers"
        component={CustomersScreen}
        options={{
          title: t("nav.customers"),
          tabBarLabel: ({ color }) => (
            <TabLabel label={t("nav.customers")} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsNavigator}
        options={{
          headerShown: false,
          title: t("nav.settings"),
          tabBarLabel: ({ color }) => (
            <TabLabel label={t("nav.settings")} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}
