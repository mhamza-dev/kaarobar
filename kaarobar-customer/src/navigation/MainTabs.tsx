import React from "react";
import { Text } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { colors } from "../lib/api";
import { useBrandPalette } from "../lib/BrandThemeContext";
import DiscoverScreen from "../screens/DiscoverScreen";
import OrdersScreen from "../screens/OrdersScreen";
import LoyaltyScreen from "../screens/LoyaltyScreen";
import AlertsScreen from "../screens/AlertsScreen";
import AccountScreen from "../screens/AccountScreen";
import StoreScreen from "../screens/StoreScreen";
import CartScreen from "../screens/CartScreen";
import CheckoutPayScreen from "../screens/CheckoutPayScreen";

const Tab = createBottomTabNavigator();
const DiscoverStack = createNativeStackNavigator();
const OrdersStack = createNativeStackNavigator();

function TabLabel({ label, color }: { label: string; color: string }) {
  return (
    <Text style={{ fontSize: 10, fontWeight: "700", color }} numberOfLines={1}>
      {label}
    </Text>
  );
}

function DiscoverNavigator() {
  return (
    <DiscoverStack.Navigator>
      <DiscoverStack.Screen
        name="DiscoverHome"
        component={DiscoverScreen}
        options={{ title: "Discover" }}
      />
      <DiscoverStack.Screen
        name="Store"
        component={StoreScreen}
        options={{ title: "Store" }}
      />
      <DiscoverStack.Screen name="Cart" component={CartScreen} options={{ title: "Cart" }} />
      <DiscoverStack.Screen
        name="CheckoutPay"
        component={CheckoutPayScreen}
        options={{ title: "Checkout" }}
      />
    </DiscoverStack.Navigator>
  );
}

function OrdersNavigator() {
  return (
    <OrdersStack.Navigator>
      <OrdersStack.Screen
        name="OrdersHome"
        component={OrdersScreen}
        options={{ title: "Orders" }}
      />
    </OrdersStack.Navigator>
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
        tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.border },
      }}
    >
      <Tab.Screen
        name="Discover"
        component={DiscoverNavigator}
        options={{
          headerShown: false,
          tabBarLabel: ({ color }) => <TabLabel label="Discover" color={color} />,
        }}
      />
      <Tab.Screen
        name="Orders"
        component={OrdersNavigator}
        options={{
          headerShown: false,
          tabBarLabel: ({ color }) => (
            <TabLabel label="Orders" color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Loyalty"
        component={LoyaltyScreen}
        options={{
          title: "Loyalty",
          tabBarLabel: ({ color }) => <TabLabel label="Loyalty" color={color} />,
        }}
      />
      <Tab.Screen
        name="Alerts"
        component={AlertsScreen}
        options={{
          title: "Alerts",
          tabBarLabel: ({ color }) => <TabLabel label="Alerts" color={color} />,
        }}
      />
      <Tab.Screen
        name="Account"
        component={AccountScreen}
        options={{
          title: "Account",
          tabBarLabel: ({ color }) => <TabLabel label="Account" color={color} />,
        }}
      />
    </Tab.Navigator>
  );
}
