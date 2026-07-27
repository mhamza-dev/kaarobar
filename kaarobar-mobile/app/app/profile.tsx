import { Redirect } from "expo-router";

/** Profile lives under Settings → Profile tab. */
export default function ProfileScreen() {
  return <Redirect href="/app/settings?tab=profile" />;
}
