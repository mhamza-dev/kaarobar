import { redirect } from "next/navigation";

/**
 * `/` has nothing of its own to render — `src/proxy.ts` sends an
 * unauthenticated request to `/login` before this ever runs; a signed-in
 * user just wants the dashboard.
 */
export default function RootPage() {
  redirect("/dashboard");
}
