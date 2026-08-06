import type { NavigationProp, ParamListBase } from "@react-navigation/native";

/** Map legacy deep-link path strings to React Navigation actions. */
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
    navigation.reset({ index: 0, routes: [{ name: "Signup" }] });
    return;
  }
  if (
    path === "/app/dashboard" ||
    path === "/app/pos" ||
    path.startsWith("/app/")
  ) {
    navigation.reset({ index: 0, routes: [{ name: "Main" }] });
    return;
  }
}

export function pushPath(
  navigation: NavigationProp<ParamListBase>,
  path: string,
  params?: Record<string, unknown>
) {
  if (path === "/app/dashboard") {
    navigation.navigate("Settings", {
      screen: "Workspace",
      ...(params && { params }),
    });
    return;
  }
  if (path === "/app/ess" || path === "/app/attendance") {
    navigation.navigate("Settings", {
      screen: "Attendance",
      ...(params && { params }),
    });
    return;
  }
  if (path === "/app/leave") {
    navigation.navigate("Settings", {
      screen: "Leave",
      ...(params && { params }),
    });
    return;
  }
  if (path === "/app/notifications") {
    navigation.navigate("Settings", {
      screen: "Notifications",
      ...(params && { params }),
    });
    return;
  }
  if (path === "/app/settings") {
    navigation.navigate("Settings", {
      screen: "SettingsHome",
      ...(params && { params }),
    });
    return;
  }
  if (path === "/app/businesses") {
    navigation.navigate("Settings", {
      screen: "Businesses",
      ...(params && { params }),
    });
    return;
  }
  if (path.startsWith("/app/businesses/")) {
    const id = path.split("/").pop();
    if (id) {
      navigation.navigate("Settings", {
        screen: "BusinessDetail",
        params: { id, ...params },
      });
    }
    return;
  }
  if (path === "/app/marketing") {
    navigation.navigate("Settings", {
      screen: "Marketing",
      ...(params && { params }),
    });
    return;
  }
  if (path.startsWith("/app/marketing/templates/")) {
    const id = path.split("/").pop();
    if (id) {
      navigation.navigate("Settings", {
        screen: "TemplateDetail",
        params: { id, ...params },
      });
    }
    return;
  }
  if (path === "/app/returns") {
    navigation.navigate("Settings", {
      screen: "Returns",
      ...(params && { params }),
    });
    return;
  }
  if (path === "/app/pos") {
    navigation.navigate("Pos", params as any);
    return;
  }
  if (path === "/app/sales") {
    navigation.navigate("Sales", params as any);
    return;
  }
  if (path === "/app/inventory" || path === "/app/products") {
    navigation.navigate("Products", params as any);
    return;
  }
  if (path === "/app/customers") {
    navigation.navigate("Customers", params as any);
    return;
  }
  if (path === "/landing" || path === "Landing") {
    replacePath(navigation, path);
    return;
  }
  if (path === "/login" || path === "Login") {
    navigation.navigate("Login", params as any);
    return;
  }
  if (path === "/signup" || path === "Signup") {
    navigation.navigate("Signup", params as any);
    return;
  }
}
