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
  if (path === "/app/sales") {
    navigation.navigate("Orders" as never);
    return;
  }
  if (path === "/app/customers" || path === "/app/accounting") {
    navigation.navigate("Loyalty" as never);
    return;
  }
  if (path === "/app/notifications") {
    navigation.navigate("Alerts" as never);
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
