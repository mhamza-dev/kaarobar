import { Platform } from "react-native";
import { api, getSession } from "./api";

/** Push registration stub for RN CLI customer app. */
export async function registerForPushNotifications(
  nativeToken?: string | null
): Promise<string | null> {
  const session = await getSession();
  if (!session?.access_token) return null;
  const token = nativeToken?.trim() || null;
  if (!token) return null;
  const platform =
    Platform.OS === "ios" ? "ios" : Platform.OS === "android" ? "android" : "web";
  try {
    await api("/device-tokens", {
      method: "POST",
      body: JSON.stringify({ platform, token }),
    });
  } catch {
    // non-fatal
  }
  return token;
}
