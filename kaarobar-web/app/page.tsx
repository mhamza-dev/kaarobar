import { redirect } from "next/navigation";

import { routes } from "@/lib/navigation";

/** App entry: home is sign-in. Marketing lives on the 2ndHub Solutions site. */
export default function Home() {
  redirect(routes.login);
}
