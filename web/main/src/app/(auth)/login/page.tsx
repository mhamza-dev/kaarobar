import Link from "next/link";
import { Suspense } from "react";

import { AuthShell } from "@/components/shared/AuthShell";
import { LoginForm } from "@/features/auth/LoginForm";

export default function LoginPage() {
  return (
    <AuthShell title="Welcome back" description="Sign in to run your shop.">
      {/* LoginForm reads the `next` query param via useSearchParams(), which
          Next requires a Suspense boundary around even in a fully
          client-rendered tree. */}
      <Suspense>
        <LoginForm />
      </Suspense>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        New to Kaarobar?{" "}
        <Link href="/register" className="font-medium text-primary hover:underline">
          Create an account
        </Link>
      </p>
    </AuthShell>
  );
}
