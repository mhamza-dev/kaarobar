import type { NavigationProp, ParamListBase } from "@react-navigation/native";

export function replacePath(
  navigation: NavigationProp<ParamListBase>,
  path: string
) {
  if (path === "/landing" || path === "Landing") {
    navigation.reset({ index: 0, routes: [{ name: "Landing" }] });
    return;
  }
  if (path === "/login" || path === "Login") {
    navigation.reset({ index: 0, routes: [{ name: "Login" }] });
    return;
  }
  if (path === "/signup" || path === "Signup") {
    navigation.navigate("Signup" as never);
    return;
  }
  if (path.startsWith("/app/") || path === "Main") {
    navigation.reset({ index: 0, routes: [{ name: "Main" }] });
  }
}

function productPathParts(path: string): { storeId: string; productId: string } | null {
  const m = path.match(/^\/app\/market\/([^/]+)\/product\/([^/]+)/);
  if (!m) return null;
  return { storeId: m[1], productId: m[2] };
}

export function pushPath(
  navigation: NavigationProp<ParamListBase>,
  path: string,
  params?: Record<string, unknown>
) {
  if (path === "/app/dashboard" || path === "/app/market" || path === "/app/market/index") {
    navigation.navigate("Discover" as never, {
      screen: "DiscoverHome",
    } as never);
    return;
  }
  if (path === "/app/products") {
    navigation.navigate("Products" as never, {
      screen: "ProductsHome",
    } as never);
    return;
  }
  if (path === "/app/sales") {
    navigation.navigate("Orders" as never, {
      screen: "OrdersHome",
    } as never);
    return;
  }
  if (path === "/app/account") {
    navigation.navigate("Account" as never, {
      screen: "AccountHome",
    } as never);
    return;
  }
  if (path === "/app/customers") {
    navigation.navigate("Loyalty" as never);
    return;
  }
  if (path === "/app/accounting") {
    navigation.navigate("Account" as never, {
      screen: "Balance",
    } as never);
    return;
  }
  if (path === "/app/notifications") {
    navigation.navigate("Account" as never, {
      screen: "Alerts",
    } as never);
    return;
  }

  const productParts = productPathParts(path);
  if (productParts) {
    // Both Discover and Products stacks register ProductDetail; Products is the
    // canonical entry for the cross-store feed and works from any tab.
    navigation.navigate("Products" as never, {
      screen: "ProductDetail",
      params: { ...productParts, ...params },
    } as never);
    return;
  }

  if (path.startsWith("/app/sales/appointments/")) {
    const id = path.split("/").pop();
    navigation.navigate("Orders" as never, {
      screen: "AppointmentDetail",
      params: { id, ...params },
    } as never);
    return;
  }
  if (path.startsWith("/app/sales/") && path !== "/app/sales") {
    const id = path.split("/").pop();
    navigation.navigate("Orders" as never, {
      screen: "OrderDetail",
      params: { id, ...params },
    } as never);
    return;
  }
  if (path.startsWith("/app/market/")) {
    const id = path.split("/").pop();
    navigation.navigate("Discover" as never, {
      screen: "Store",
      params: { id, ...params },
    } as never);
    return;
  }
  if (path === "/app/checkout" || path === "/app/checkout/index") {
    navigation.navigate("Discover" as never, {
      screen: "Cart",
    } as never);
    return;
  }
  if (path === "/app/checkout/pay") {
    navigation.navigate("Discover" as never, {
      screen: "CheckoutPay",
    } as never);
    return;
  }
  if (path === "/landing") {
    replacePath(navigation, path);
    return;
  }
  if (path === "/login") {
    replacePath(navigation, path);
    return;
  }
  if (path === "/signup") {
    navigation.navigate("Signup" as never);
  }
}
