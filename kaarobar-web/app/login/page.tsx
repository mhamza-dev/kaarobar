"use client";

import { Suspense, useCallback, useState } from "react";
import Link from "@/components/ui/Link";

import AuthShell from "@/components/auth/AuthShell";
import GuestOnly from "@/components/auth/GuestOnly";
import LoginForm from "@/components/auth/LoginForm";
import { routes } from "@/lib/navigation";
import type { AuthActor } from "@/lib/api/client";

function LoginInner() {
  const [actor, setActor] = useState<AuthActor>("business");
  const onActorChange = useCallback((next: AuthActor) => setActor(next), []);

  const isBuyer = actor === "consumer";

  return (
    <GuestOnly>
      <AuthShell
        badge={isBuyer ? "Customer sign-in" : "Staff sign-in"}
        title={isBuyer ? "Sign in to shop" : "Sign in to Kaarobar"}
        subtitle={
          isBuyer
            ? "Browse stores, place pickup orders, and check your points."
            : "Open the workspace for your businesses and branches."
        }
        footer={
          isBuyer ? (
            <>
              New here?{" "}
              <Link href={`${routes.signup}?as=consumer`} variant="link">
                Create a customer account
              </Link>
            </>
          ) : (
            <>
              Need an account?{" "}
              <Link href={routes.signup} variant="link">
                Create one
              </Link>
            </>
          )
        }
      >
        <LoginForm actor={actor} onActorChange={onActorChange} />
      </AuthShell>
    </GuestOnly>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}
