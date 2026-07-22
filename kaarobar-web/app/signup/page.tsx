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
        badge={isBuyer ? "Shop with Kaarobar" : "Start free trial"}
        title={isBuyer ? "Create a consumer account" : "Create your owner account"}
        subtitle={
          isBuyer
            ? "Order from marketplace stores and track loyalty across businesses."
            : "We’ll set up your first business, a Pakistan chart of accounts, and a starting branch."
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
