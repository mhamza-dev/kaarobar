import { Platform } from "react-native";
import { api, getSession } from "./api";

/**
 * Push registration stub for RN CLI.
 * Wire FCM/APNs tokens here when native push is configured.
 * NOT-FR device token registration still posts when a token is supplied.
 */
export async function registerForPushNotifications(
  nativeToken?: string | null
): Promise<string | null> {
  const session = await getSession();
  if (!session?.access_token) return null;

  const token = nativeToken?.trim() || null;
  if (!token) {
    return null;
  }

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
