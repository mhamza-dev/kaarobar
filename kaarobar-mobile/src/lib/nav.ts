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
    navigation.navigate("Login" as never);
    return;
  }
  if (path === "/signup" || path === "Signup") {
    navigation.navigate("Signup" as never);
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
    navigation.navigate("Settings" as never, {
      screen: "Workspace",
    } as never);
    return;
  }
  if (path === "/app/ess" || path === "/app/attendance") {
    navigation.navigate("Settings" as never, {
      screen: "Attendance",
      params,
    } as never);
    return;
  }
  if (path === "/app/leave") {
    navigation.navigate("Settings" as never, {
      screen: "Leave",
    } as never);
    return;
  }
  if (path === "/app/notifications") {
    navigation.navigate("Settings" as never, {
      screen: "Notifications",
    } as never);
    return;
  }
  if (path === "/app/settings") {
    navigation.navigate("Settings" as never, {
      screen: "SettingsHome",
      params,
    } as never);
    return;
  }
  if (path === "/app/businesses") {
    navigation.navigate("Settings" as never, {
      screen: "Businesses",
    } as never);
    return;
  }
  if (path.startsWith("/app/businesses/")) {
    const id = path.split("/").pop();
    navigation.navigate("Settings" as never, {
      screen: "BusinessDetail",
      params: { id },
    } as never);
    return;
  }
  if (path === "/app/marketing") {
    navigation.navigate("Settings" as never, {
      screen: "Marketing",
      params,
    } as never);
    return;
  }
  if (path.startsWith("/app/marketing/templates/")) {
    const id = path.split("/").pop();
    navigation.navigate("Settings" as never, {
      screen: "TemplateDetail",
      params: { id },
    } as never);
    return;
  }
  if (path === "/app/returns") {
    navigation.navigate("Settings" as never, {
      screen: "Returns",
    } as never);
    return;
  }
  if (path === "/app/pos") {
    navigation.navigate("Pos" as never);
    return;
  }
  if (path === "/app/sales") {
    navigation.navigate("Sales" as never);
    return;
  }
  if (path === "/app/inventory" || path === "/app/products") {
    navigation.navigate("Products" as never, params as never);
    return;
  }
  if (path === "/app/customers") {
    navigation.navigate("Customers" as never);
    return;
  }
  if (path === "/landing") {
    replacePath(navigation, path);
    return;
  }
  if (path === "/login") {
    navigation.navigate("Login" as never);
    return;
  }
  if (path === "/signup") {
    navigation.navigate("Signup" as never);
  }
}
