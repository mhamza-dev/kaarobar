import { redirect } from "next/navigation";

/** Profile lives under Settings → Profile tab. */
export default function ProfileRedirectPage() {
  redirect("/app/settings?tab=profile");
}
