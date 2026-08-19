import type { NavigationProp, ParamListBase } from "@react-navigation/native";

/**
 * React Navigation 7.3 types `navigate` against a typed param list, so the
 * two-argument form no longer accepts `as never` casts. This app resolves route
 * names at runtime from `/app/*` path strings, so funnel every call through one
 * narrow escape hatch instead of re-casting at 15 call sites.
 */
export function go(
  navigation: NavigationProp<ParamListBase>,
  name: string,
  params?: Record<string, unknown>
) {
  (navigation.navigate as (screen: string, params?: Record<string, unknown>) => void)(
    name,
    params
  );
}

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
    go(navigation, "Signup");
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
    go(navigation, "Discover", {
      screen: "DiscoverHome",
    });
    return;
  }
  if (path === "/app/products") {
    // Products route is an alias of Discover (product-first home).
    go(navigation, "Discover", {
      screen: "DiscoverHome",
    });
    return;
  }
  if (path === "/app/sales") {
    go(navigation, "Orders", {
      screen: "OrdersHome",
    });
    return;
  }
  if (path === "/app/account") {
    go(navigation, "Account", {
      screen: "AccountHome",
    });
    return;
  }
  if (path === "/app/customers") {
    go(navigation, "Loyalty");
    return;
  }
  if (path === "/app/accounting") {
    go(navigation, "Account", {
      screen: "Balance",
    });
    return;
  }
  if (path === "/app/notifications") {
    go(navigation, "Account", {
      screen: "Alerts",
    });
    return;
  }

  const productParts = productPathParts(path);
  if (productParts) {
    go(navigation, "Discover", {
      screen: "ProductDetail",
      params: { ...productParts, ...params },
    });
    return;
  }

  if (path.startsWith("/app/sales/appointments/")) {
    const id = path.split("/").pop();
    go(navigation, "Orders", {
      screen: "AppointmentDetail",
      params: { id, ...params },
    });
    return;
  }
  if (path.startsWith("/app/sales/") && path !== "/app/sales") {
    const id = path.split("/").pop();
    go(navigation, "Orders", {
      screen: "OrderDetail",
      params: { id, ...params },
    });
    return;
  }
  if (path.startsWith("/app/market/")) {
    const id = path.split("/").pop();
    go(navigation, "Discover", {
      screen: "Store",
      params: { id, ...params },
    });
    return;
  }
  if (path === "/app/checkout" || path === "/app/checkout/index") {
    go(navigation, "Discover", {
      screen: "Cart",
    });
    return;
  }
  if (path === "/app/checkout/pay") {
    go(navigation, "Discover", {
      screen: "CheckoutPay",
    });
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
    go(navigation, "Signup");
  }
}
