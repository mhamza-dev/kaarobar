"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getSession } from "@/lib/api/client";
import { routes } from "@/lib/navigation";

/** Logged-in owners skip the marketing landing and go straight to the dashboard. */
export default function HomeAuthRedirect() {
  const router = useRouter();

  useEffect(() => {
    if (getSession()) {
      router.replace(routes.app);
    }
  }, [router]);

  return null;
}
