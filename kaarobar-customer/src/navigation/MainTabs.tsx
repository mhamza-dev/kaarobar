import React from "react";
import { Text } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { colors } from "../lib/api";
import { useBrandPalette } from "../lib/BrandThemeContext";
import { t } from "../lib/i18n";
import DiscoverScreen from "../screens/DiscoverScreen";
import ProductsScreen from "../screens/ProductsScreen";
import ProductDetailScreen from "../screens/ProductDetailScreen";
import OrdersScreen from "../screens/OrdersScreen";
import OrderDetailScreen from "../screens/OrderDetailScreen";
import AppointmentDetailScreen from "../screens/AppointmentDetailScreen";
import LoyaltyScreen from "../screens/LoyaltyScreen";
import AlertsScreen from "../screens/AlertsScreen";
import AccountScreen from "../screens/AccountScreen";
import StoreScreen from "../screens/StoreScreen";
import CartScreen from "../screens/CartScreen";
import CheckoutPayScreen from "../screens/CheckoutPayScreen";
import KhataScreen from "../screens/KhataScreen";

const Tab = createBottomTabNavigator();
const DiscoverStack = createNativeStackNavigator();
const ProductsStack = createNativeStackNavigator();
const OrdersStack = createNativeStackNavigator();
const AccountStack = createNativeStackNavigator();

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
        options={{ title: t("nav.discover") }}
      />
      <DiscoverStack.Screen
        name="Store"
        component={StoreScreen}
        options={{ title: t("marketplace.store") }}
      />
      <DiscoverStack.Screen
        name="ProductDetail"
        component={ProductDetailScreen}
        options={{ title: t("pages.productDetailTitle") }}
      />
      <DiscoverStack.Screen name="Cart" component={CartScreen} options={{ title: t("pos.cart") }} />
      <DiscoverStack.Screen
        name="CheckoutPay"
        component={CheckoutPayScreen}
        options={{ title: t("pages.checkoutPayTitle") }}
      />
    </DiscoverStack.Navigator>
  );
}

function ProductsNavigator() {
  return (
    <ProductsStack.Navigator>
      <ProductsStack.Screen
        name="ProductsHome"
        component={ProductsScreen}
        options={{ title: t("nav.products") }}
      />
      <ProductsStack.Screen
        name="ProductDetail"
        component={ProductDetailScreen}
        options={{ title: t("pages.productDetailTitle") }}
      />
      <ProductsStack.Screen
        name="Store"
        component={StoreScreen}
        options={{ title: t("marketplace.store") }}
      />
      <ProductsStack.Screen name="Cart" component={CartScreen} options={{ title: t("pos.cart") }} />
      <ProductsStack.Screen
        name="CheckoutPay"
        component={CheckoutPayScreen}
        options={{ title: t("pages.checkoutPayTitle") }}
      />
    </ProductsStack.Navigator>
  );
}

function OrdersNavigator() {
  return (
    <OrdersStack.Navigator>
      <OrdersStack.Screen
        name="OrdersHome"
        component={OrdersScreen}
        options={{ title: t("nav.orders") }}
      />
      <OrdersStack.Screen
        name="OrderDetail"
        component={OrderDetailScreen}
        options={{ title: t("marketplace.orderDetailTitle") }}
      />
      <OrdersStack.Screen
        name="AppointmentDetail"
        component={AppointmentDetailScreen}
        options={{ title: t("pages.appointmentDetailTitle") }}
      />
    </OrdersStack.Navigator>
  );
}

function AccountNavigator() {
  return (
    <AccountStack.Navigator>
      <AccountStack.Screen
        name="AccountHome"
        component={AccountScreen}
        options={{ title: t("nav.account") }}
      />
      <AccountStack.Screen
        name="Alerts"
        component={AlertsScreen}
        options={{ title: t("nav.notifications") }}
      />
      <AccountStack.Screen
        name="Balance"
        component={KhataScreen}
        options={{ title: t("pages.buyerArTitle") }}
      />
    </AccountStack.Navigator>
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
          tabBarLabel: ({ color }) => <TabLabel label={t("nav.discover")} color={color} />,
        }}
      />
      <Tab.Screen
        name="Products"
        component={ProductsNavigator}
        options={{
          headerShown: false,
          tabBarLabel: ({ color }) => <TabLabel label={t("nav.products")} color={color} />,
        }}
      />
      <Tab.Screen
        name="Orders"
        component={OrdersNavigator}
        options={{
          headerShown: false,
          tabBarLabel: ({ color }) => <TabLabel label={t("nav.orders")} color={color} />,
        }}
      />
      <Tab.Screen
        name="Loyalty"
        component={LoyaltyScreen}
        options={{
          title: t("nav.loyalty"),
          tabBarLabel: ({ color }) => <TabLabel label={t("nav.loyalty")} color={color} />,
        }}
      />
      <Tab.Screen
        name="Account"
        component={AccountNavigator}
        options={{
          headerShown: false,
          tabBarLabel: ({ color }) => <TabLabel label={t("nav.account")} color={color} />,
        }}
      />
    </Tab.Navigator>
  );
}
