import { Redirect } from "expo-router";

/** Legacy path → `/app/dashboard`. */
export default function LegacyDashboardRedirect() {
  return <Redirect href="/app/dashboard" />;
}
