"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getSession } from "@/lib/api/client";
import { routes } from "@/lib/navigation";

/** Prevent authenticated users from staying on login/signup. */
export default function GuestOnly({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    if (getSession()) {
      router.replace(routes.app);
    }
  }, [router]);

  return <>{children}</>;
}
