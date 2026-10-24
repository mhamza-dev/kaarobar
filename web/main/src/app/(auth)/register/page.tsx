import Link from "next/link";

import { AuthShell } from "@/components/shared/AuthShell";
import { RegisterForm } from "@/features/auth/RegisterForm";

/** `?plan=<code>` arrives from the marketing site's pricing page. */
export default async function RegisterPage({ searchParams }: PageProps<"/register">) {
  const { plan } = await searchParams;
  const initialPlan = Array.isArray(plan) ? plan[0] : plan;

  return (
    <AuthShell
      title="Set up your shop"
      documentTitle="Create your account"
      description="One account, your whole business."
    >
      <RegisterForm initialPlan={initialPlan} />
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
