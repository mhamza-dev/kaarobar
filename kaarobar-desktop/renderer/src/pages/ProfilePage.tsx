import { Navigate } from "react-router-dom";

/** Profile lives under Settings → Profile tab. */
export default function ProfilePage() {
  return <Navigate to="/app/settings?tab=profile" replace />;
}
