"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "@/components/ui/Link";

import AuthShell from "@/components/auth/AuthShell";
import GuestOnly from "@/components/auth/GuestOnly";
import SignupForm from "@/components/auth/SignupForm";
import { routes } from "@/lib/navigation";
import type { AuthActor } from "@/lib/api/client";

function SignupInner() {
  const searchParams = useSearchParams();
  const [actor, setActor] = useState<AuthActor>("business");

  useEffect(() => {
    if (searchParams.get("as") === "consumer") setActor("consumer");
  }, [searchParams]);

  const isBuyer = actor === "consumer";

  return (
    <GuestOnly>
      <AuthShell
        badge={isBuyer ? "Customer account" : "Owner account"}
        title={isBuyer ? "Create a customer account" : "Create your Kaarobar account"}
        subtitle={
          isBuyer
            ? "Order from stores on the marketplace and keep loyalty in one place."
            : "We will create your first business, a Pakistan chart of accounts, and a starting branch."
        }
        footer={
          <>
            Already have an account?{" "}
            <Link
              href={isBuyer ? `${routes.login}?as=consumer` : routes.login}
              variant="link"
            >
              Sign in
            </Link>
          </>
        }
      >
        <SignupForm actor={actor} />
      </AuthShell>
    </GuestOnly>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupInner />
    </Suspense>
  );
}
